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
import { notifyOnce } from "@/lib/notify";
import type { MetricKey } from "@/data/types";
import { graphGet, graphGetAll, mapPool, UNIFIED_ATTRIBUTION } from "./client";
import { fetchAdSetDailyBudgets, effectiveDailyBudget } from "./budget";
import { getActiveToken } from "./auth";
import { insightMetrics, toAdStatus, INSIGHT_WINDOW_DAYS, type MetaInsightRow } from "./map";
import { setCampaignStatus } from "./mutations";
import { matchCampaignToProduct } from "./productMatch";
import { syncCreatives, type CampaignRef } from "./syncCreatives";
import { fetchBreakdown } from "./breakdown";
import { INSIGHT_WINDOWS } from "@/lib/windows";

export const INSIGHT_FIELDS =
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
export async function runSync(
  opts: { mode?: "full" | "map"; onProgress?: (p: { stage: string; pct: number }) => void } = {},
): Promise<SyncResult> {
  const mode = opts.mode ?? "full";
  const onProgress = opts.onProgress;
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
  const targets = accounts.filter((a) => !allow.length || allow.includes(`act_${a.account_id}`));

  // Products are account-independent — fetch once and reuse for every account
  // (was re-queried inside the per-account loop).
  const products = await prisma.product.findMany({
    select: {
      id: true, sku: true, thName: true, closeMode: true, skipMetrics: true,
      thrRoas: true, thrCtr: true, thrCpa: true, thrCpm: true, thrCpp: true, thrCpr: true, thrCost: true,
    },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  // Progress: one substep per account per stage (campaigns [+ creatives, breakdown in full]).
  const subPerAcct = mode === "full" ? 3 : 1;
  const totalSteps = Math.max(1, targets.length * subPerAcct);
  let doneSteps = 0;
  const emit = (stage: string) =>
    onProgress?.({ stage, pct: Math.min(99, Math.round((doneSteps / totalSteps) * 100)) });
  onProgress?.({ stage: `พบ ${targets.length} บัญชี · ${targets.length} accounts`, pct: 2 });

  const syncAccount = async (a: MetaAccount, ai: number): Promise<void> => {
    const actId = `act_${a.account_id}`;
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
      emit(`แคมเปญ · Campaigns — ${a.name} (${ai + 1}/${targets.length})`);

      // metaCampaignId → local Campaign row, for linking creatives in the creative pass.
      const campaignIdMap = new Map<string, CampaignRef>();

      // 1+2. campaign insights per window (7/30/90d) and campaign metadata are all
      //      independent Graph calls — fire them together instead of one after another.
      //      Selection + auto-close use the 30d map; every window is stored as a snapshot.
      type CampRow = MetaInsightRow & { campaign_id?: string; campaign_name?: string };
      const [windowEntries, metaRows, adsetBudgetByCampaign] = await Promise.all([
        Promise.all(
          campaignWindows.map(async (window) => {
            const res = await graphGet<{ data: CampRow[] }>(
              `/${actId}/insights`,
              { level: "campaign", date_preset: window, fields: INSIGHT_FIELDS, limit: 500, ...UNIFIED_ATTRIBUTION },
              token,
            );
            const m = new Map<string, CampRow>();
            for (const row of res.data ?? []) if (row.campaign_id) m.set(row.campaign_id, row);
            return [window, m] as const;
          }),
        ),
        graphGetAll<MetaCampaign>(
          `/${actId}/campaigns`,
          { fields: "id,name,status,effective_status,objective,daily_budget" },
          token,
        ),
        // Ad-set budgets, for non-CBO campaigns where the daily budget lives on the
        // ad set (campaign.daily_budget is empty). One paginated call per account.
        fetchAdSetDailyBudgets(actId, token),
      ]);
      const insByWindow = new Map<string, Map<string, CampRow>>(windowEntries);
      const delivering = insByWindow.get("last_30d")!;
      const metaById = new Map(metaRows.map((c) => [c.id, c]));

      // 3. upsert campaigns that delivered OR are active
      const ids = new Set<string>([
        ...delivering.keys(),
        ...metaRows.filter((c) => toAdStatus(c.status) === "ACTIVE").map((c) => c.id),
      ]);
      // Prefetch existing rows for this account in one query — was a findUnique per
      // campaign, each a full cross-region round-trip.
      const existingByMetaId = new Map(
        (
          await prisma.campaign.findMany({
            where: { metaCampaignId: { in: [...ids] } },
            select: { metaCampaignId: true, productId: true, status: true, statusSource: true },
          })
        ).map((c) => [c.metaCampaignId, c]),
      );
      for (const id of ids) {
        const c = metaById.get(id);
        const name = c?.name ?? delivering.get(id)?.campaign_name ?? "Campaign";
        const existing = existingByMetaId.get(id);
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
          // Campaign-level budget (CBO) wins; otherwise fall back to the summed
          // ad-set budgets so non-CBO campaigns show their real งบต่อวัน, not ฿0.
          dailyBudgetMinor: effectiveDailyBudget(c?.daily_budget, adsetBudgetByCampaign.get(id)),
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
        // Replace this campaign's window snapshots in two queries (was a
        // deleteMany + create per window — 6 round-trips → 2).
        await prisma.insightSnapshot.deleteMany({
          where: { level: "CAMPAIGN", campaignId: camp.id, window: { in: [...campaignWindows] } },
        });
        const snapRows = campaignWindows.flatMap((window) => {
          const wr = insByWindow.get(window)!.get(id);
          return wr
            ? [{ level: "CAMPAIGN" as const, window, campaignId: camp.id, ...insightMetrics(wr), fetchedAt: new Date() }]
            : [];
        });
        if (snapRows.length) {
          await prisma.insightSnapshot.createMany({ data: snapRows });
          counts.insights += snapRows.length;
        }

        // KPI verdict for a still-active campaign whose product enforces a close
        // policy (SUGGEST/AUTO). Drives the "ควรปิด" alert and the AUTO auto-close.
        const product = productId ? productById.get(productId) : undefined;
        if (row && product && product.closeMode !== "OFF" && metaStatus === "ACTIVE") {
          const m = insightMetrics(row);
          const verdict = evalCampaign(
            { roas: m.roas, ctr: m.ctr, cpa: m.cpa, cpm: m.cpm, cpp: m.cpp, cpr: m.cpr, cost: m.spend / INSIGHT_WINDOW_DAYS },
            { roas: product.thrRoas, ctr: product.thrCtr, cpa: product.thrCpa, cpm: product.thrCpm, cpp: product.thrCpp, cpr: product.thrCpr, cost: product.thrCost },
            product.skipMetrics as MetricKey[],
          ).verdict;
          if (verdict === "breach") {
            // Notify the team (once/day) that this active campaign should be closed.
            await notifyOnce({
              kind: "warn",
              title: `ควรปิด · ${name}`,
              detail: `${name} เกินเกณฑ์ KPI · ยังเปิดอยู่ใน Meta — แนะนำให้ปิด`,
            }).catch(() => {});
            // Auto-close write-back (opt-in) — AUTO products only, never a human-set one.
            if (
              mode === "full" &&
              AUTO_CLOSE_ENABLED &&
              product.closeMode === "AUTO" &&
              statusSource !== "MANUAL"
            ) {
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
      }

      // map mode stops here — discovery + grouping + 30d campaign metrics only.
      doneSteps++; // campaign + insights stage complete
      if (mode !== "full") return;

      // 4. creative pass — every ad/creative + its post & video funnel (after the
      // campaign pass so links resolve against just-synced campaigns).
      emit(`ครีเอทีฟ · Creatives — ${a.name} (${ai + 1}/${targets.length})`);
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
      doneSteps++; // creative stage complete

      // 5. account-level audience breakdown per window (Breakdown page) — windows are
      //    independent, so fetch + upsert them concurrently instead of serially.
      emit(`ผู้ชม · Audience — ${a.name} (${ai + 1}/${targets.length})`);
      await Promise.all(
        INSIGHT_WINDOWS.map(async (window) => {
          try {
            const data = (await fetchBreakdown(actId, token, {
              key: window,
              datePreset: window,
            })) as unknown as Prisma.InputJsonValue;
            await prisma.breakdownSnapshot.upsert({
              where: { adAccountId_window: { adAccountId: account.id, window } },
              update: { data, fetchedAt: new Date() },
              create: { adAccountId: account.id, window, data, fetchedAt: new Date() },
            });
            counts.breakdowns++;
          } catch (e) {
            counts.errors.push(`breakdown ${actId} ${window}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }),
      );
      doneSteps++; // breakdown stage complete
    } catch (e) {
      counts.errors.push(`${actId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Accounts touch disjoint rows and Meta rate-limits per account, so sync several at
  // once. Cap concurrency to stay friendly to the Graph API and the Postgres pool.
  await mapPool(targets, 4, syncAccount);

  // Coarse timing so we can compare wall-clock before/after co-locating the function
  // with the DB (see vercel.json regions). Shows total elapsed + what got written.
  const elapsedMs = Date.now() - Date.parse(startedAt);
  console.log(
    `[sync] mode=${mode} accounts=${counts.accounts} campaigns=${counts.campaigns} ` +
      `creatives=${counts.creatives} insights=${counts.insights} breakdowns=${counts.breakdowns} ` +
      `elapsed=${elapsedMs}ms errors=${counts.errors.length}`,
  );

  onProgress?.({ stage: "เสร็จสิ้น · Done", pct: 100 });
  return counts;
}
