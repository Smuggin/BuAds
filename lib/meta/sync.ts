/**
 * Read-only sync: pull real Meta accounts → delivering campaigns → insights →
 * every creative (+ its post & video funnel) into the Prisma cache. Delivery-driven
 * (mirrors Ads Manager's last-30d view): we keep campaigns that delivered in the
 * window OR are currently active. Idempotent (upsert by meta*Id). Never overwrites a
 * user-set Campaign.productId. Creative pass lives in syncCreatives.ts. Server-only.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { accountMetaFor } from "@/lib/constants";
import { evalCampaign } from "@/lib/kpi";
import type { MetricKey } from "@/data/types";
import { graphGet, graphGetAll } from "./client";
import { getActiveToken } from "./auth";
import { insightMetrics, toAdStatus, INSIGHT_WINDOW_DAYS, type MetaInsightRow } from "./map";
import { setCampaignStatus } from "./mutations";
import { matchCampaignToProduct } from "./productMatch";
import { syncCreatives, type CampaignRef } from "./syncCreatives";
import { fetchBreakdown } from "./breakdown";
import { INSIGHT_WINDOWS } from "@/lib/windows";

const INSIGHT_FIELDS =
  "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpm,reach,frequency,purchase_roas,actions,cost_per_action_type";

// Auto-close write-back to Meta (pauses losers) is OPT-IN — off until tested.
// Set META_AUTO_CLOSE=on to enable; otherwise breaching campaigns are flag-only.
const AUTO_CLOSE_ENABLED = (process.env.META_AUTO_CLOSE ?? "off").toLowerCase() === "on";

interface MetaAccount { account_id: string; name: string; currency?: string; account_status?: number }
interface MetaCampaign { id: string; name: string; status?: string; effective_status?: string; objective?: string; daily_budget?: string }

export interface SyncResult {
  accounts: number;
  campaigns: number;
  insights: number;
  autoClosed: number;
  creatives: number;
  creativeLinks: number;
  creativeInsights: number;
  breakdowns: number;
  startedAt: string;
  errors: string[];
}

/** All ad accounts the token can reach: personal + every business's owned/client accounts. */
export async function gatherAccounts(token: string): Promise<MetaAccount[]> {
  const map = new Map<string, MetaAccount>();
  const add = (a: MetaAccount) => {
    if (a.account_id && !map.has(a.account_id)) map.set(a.account_id, a);
  };
  const fields = "account_id,name,currency,account_status";
  for (const a of await graphGetAll<MetaAccount>("/me/adaccounts", { fields }, token)) add(a);
  try {
    const businesses = await graphGetAll<{ id: string }>("/me/businesses", { fields: "id,name" }, token);
    for (const b of businesses) {
      for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
        try {
          for (const a of await graphGetAll<MetaAccount>(`/${b.id}/${edge}`, { fields }, token)) add(a);
        } catch {
          /* edge not accessible — skip */
        }
      }
    }
  } catch {
    /* businesses not accessible — personal accounts only */
  }
  return [...map.values()];
}

/**
 * mode "full" (default): everything — campaign insights (7/30/90d), creatives,
 * breakdown, auto-close. mode "map": light cron pass — discover campaigns, group
 * each to its SKU, and refresh 30d campaign metrics only. Skips the heavy
 * creative/breakdown/multi-window passes so it's safe to run on a schedule.
 */
export async function runSync(opts: { mode?: "full" | "map" } = {}): Promise<SyncResult> {
  const mode = opts.mode ?? "full";
  const campaignWindows = mode === "full" ? INSIGHT_WINDOWS : (["last_30d"] as const);
  const startedAt = new Date().toISOString();
  const token = await getActiveToken();
  const counts: SyncResult = {
    accounts: 0, campaigns: 0, insights: 0, autoClosed: 0,
    creatives: 0, creativeLinks: 0, creativeInsights: 0, breakdowns: 0, startedAt, errors: [],
  };

  const allow = (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const accounts = await gatherAccounts(token);

  for (const a of accounts) {
    const actId = `act_${a.account_id}`;
    if (allow.length && !allow.includes(actId)) continue;
    try {
      const meta = accountMetaFor(actId, a.name);
      const status = a.account_status === 1 ? "ACTIVE" : "WARNING";
      const account = await prisma.adAccount.upsert({
        where: { metaAccountId: actId },
        update: { name: a.name, currency: a.currency ?? "THB", connected: true, status, lastSyncAt: new Date() },
        create: {
          metaAccountId: actId, name: a.name, platform: "Meta · FB + IG",
          initials: meta.initials, color: meta.color, currency: a.currency ?? "THB",
          connected: true, status, lastSyncAt: new Date(),
        },
      });
      counts.accounts++;

      const products = await prisma.product.findMany({
        select: {
          id: true, sku: true, thName: true, closeMode: true, skipMetrics: true,
          thrRoas: true, thrCtr: true, thrCpa: true, thrCpm: true, thrCpp: true, thrCpr: true, thrCost: true,
        },
      });
      const productById = new Map(products.map((p) => [p.id, p]));
      // metaCampaignId → local Campaign row, for linking creatives in the creative pass.
      const campaignIdMap = new Map<string, CampaignRef>();

      // 1. campaign insights per window (7/30/90d) — names + metrics come from insights.
      //    Selection + auto-close use the 30d map; all three are stored as snapshots.
      type CampRow = MetaInsightRow & { campaign_id?: string; campaign_name?: string };
      const insByWindow = new Map<string, Map<string, CampRow>>();
      for (const window of campaignWindows) {
        const res = await graphGet<{ data: CampRow[] }>(
          `/${actId}/insights`,
          { level: "campaign", date_preset: window, fields: INSIGHT_FIELDS, limit: 500 },
          token,
        );
        const m = new Map<string, CampRow>();
        for (const row of res.data ?? []) if (row.campaign_id) m.set(row.campaign_id, row);
        insByWindow.set(window, m);
      }
      const delivering = insByWindow.get("last_30d")!;

      // 2. campaign metadata (status/budget/objective)
      const metaRows = await graphGetAll<MetaCampaign>(
        `/${actId}/campaigns`,
        { fields: "id,name,status,effective_status,objective,daily_budget" },
        token,
      );
      const metaById = new Map(metaRows.map((c) => [c.id, c]));

      // 3. upsert campaigns that delivered OR are active
      const ids = new Set<string>([
        ...delivering.keys(),
        ...metaRows.filter((c) => toAdStatus(c.status) === "ACTIVE").map((c) => c.id),
      ]);
      for (const id of ids) {
        const c = metaById.get(id);
        const name = c?.name ?? delivering.get(id)?.campaign_name ?? "Campaign";
        const existing = await prisma.campaign.findUnique({ where: { metaCampaignId: id } });
        const productId = existing?.productId ?? matchCampaignToProduct(name, products);
        const metaStatus = toAdStatus(c?.status);
        // Keep our own marker (AUTO/MANUAL) while Meta's status is unchanged since the
        // last snapshot; a change on Meta's side resets it to META.
        const statusSource =
          existing && existing.status === metaStatus ? existing.statusSource : "META";
        const data = {
          name,
          status: metaStatus,
          effectiveStatus: c?.effective_status,
          objective: c?.objective,
          dailyBudgetMinor: c?.daily_budget ? parseInt(c.daily_budget) : 0,
          statusSource,
          adAccountId: account.id,
          productId,
          syncedAt: new Date(),
        };
        const camp = await prisma.campaign.upsert({
          where: { metaCampaignId: id }, update: data, create: { metaCampaignId: id, ...data },
        });
        campaignIdMap.set(id, { id: camp.id, productId });
        counts.campaigns++;

        const row = delivering.get(id); // 30d row drives auto-close below
        for (const window of campaignWindows) {
          const wr = insByWindow.get(window)!.get(id);
          await prisma.insightSnapshot.deleteMany({ where: { level: "CAMPAIGN", window, campaignId: camp.id } });
          if (wr) {
            await prisma.insightSnapshot.create({
              data: { level: "CAMPAIGN", window, campaignId: camp.id, ...insightMetrics(wr), fetchedAt: new Date() },
            });
            counts.insights++;
          }
        }

        // Auto-close: pause a still-active, breaching campaign in Meta when its
        // product opts in. Skips a campaign a human deliberately set (MANUAL).
        const product = productId ? productById.get(productId) : undefined;
        if (
          mode === "full" &&
          AUTO_CLOSE_ENABLED &&
          row &&
          product?.closeMode === "AUTO" &&
          metaStatus === "ACTIVE" &&
          statusSource !== "MANUAL"
        ) {
          const m = insightMetrics(row);
          const verdict = evalCampaign(
            { roas: m.roas, ctr: m.ctr, cpa: m.cpa, cpm: m.cpm, cpp: m.cpp, cpr: m.cpr, cost: m.spend / INSIGHT_WINDOW_DAYS },
            { roas: product.thrRoas, ctr: product.thrCtr, cpa: product.thrCpa, cpm: product.thrCpm, cpp: product.thrCpp, cpr: product.thrCpr, cost: product.thrCost },
            product.skipMetrics as MetricKey[],
          ).verdict;
          if (verdict === "breach") {
            try {
              await setCampaignStatus(id, "PAUSED", token);
              await prisma.campaign.update({
                where: { metaCampaignId: id },
                data: { status: "PAUSED", statusSource: "AUTO" },
              });
              await prisma.activityLog.create({
                data: { actor: "AUTO", type: "AUTO_CLOSE", campaignId: camp.id, productId, title: "ปิดแคมเปญอัตโนมัติ", detail: `${name} · เกินเกณฑ์ KPI` },
              });
              counts.autoClosed++;
            } catch (e) {
              counts.errors.push(`autoclose ${id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }

      // map mode stops here — discovery + grouping + 30d campaign metrics only.
      if (mode !== "full") continue;

      // 4. creative pass — every ad/creative + its post & video funnel (after the
      // campaign pass so links resolve against just-synced campaigns).
      const cr = await syncCreatives(
        { id: account.id, metaAccountId: actId },
        token,
        campaignIdMap,
        products,
      );
      counts.creatives += cr.creatives;
      counts.creativeLinks += cr.links;
      counts.creativeInsights += cr.insights;
      counts.errors.push(...cr.errors);

      // 5. account-level audience breakdown per window (Breakdown page).
      for (const window of INSIGHT_WINDOWS) {
        try {
          const data = (await fetchBreakdown(actId, token, window)) as unknown as Prisma.InputJsonValue;
          await prisma.breakdownSnapshot.upsert({
            where: { adAccountId_window: { adAccountId: account.id, window } },
            update: { data, fetchedAt: new Date() },
            create: { adAccountId: account.id, window, data, fetchedAt: new Date() },
          });
          counts.breakdowns++;
        } catch (e) {
          counts.errors.push(`breakdown ${actId} ${window}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      counts.errors.push(`${actId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return counts;
}
