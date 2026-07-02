/**
 * Fast on-demand insight sync for a single time selection ("today" / custom range),
 * stored under the spec's window key so the existing read-APIs serve it unchanged.
 *
 * Tuned for latency (this runs interactively behind the range picker):
 *  - accounts processed CONCURRENTLY (bounded pool), not sequentially;
 *  - only the 2 calls Overview + Campaigns need per account — campaign insights and
 *    a lightweight account-level daily-spend series — NOT the 4-call audience
 *    breakdown (age/gender/region/hour), which the full nightly sync still covers;
 *  - DB writes batched (one deleteMany + one createMany per account) instead of
 *    per-campaign round-trips.
 * Campaigns must already exist from a regular sync; unknown ones are skipped.
 * Server-only.
 */
import { prisma } from "@/lib/db";
import { getActiveToken } from "./auth";
import { graphGet, graphGetAll } from "./client";
import { gatherAccounts, INSIGHT_FIELDS } from "./sync";
import { AD_INSIGHT_FIELDS } from "./syncCreatives";
import { aggregateInsights, hourIndex24, insightMetrics, type MetaInsightRow } from "./map";
import { fetchAdSetDailyBudgets, effectiveDailyBudget } from "./budget";
import { timeParams, type TimeSpec } from "@/lib/windows";

type CampRow = MetaInsightRow & { campaign_id?: string };
type CampMeta = { id: string; daily_budget?: string };
type AdLite = { id?: string; creative?: { id?: string } };

export interface RangeSyncResult {
  window: string;
  accounts: number;
  campaigns: number;
  creatives: number;
  errors: string[];
}

const CONCURRENCY = 6;

/** Minimal ad→creative link (creative metadata already exists from the full sync). */
const AD_CREATIVE_FIELDS = "id,creative{id}";

/** Account-level daily spend + revenue for the window (one call), keyed by ISO
 *  date. Revenue = spend × purchase_roas, matching the full-sync breakdown
 *  (see lib/meta/breakdown.ts) so the Overview daily chart's Revenue toggle has
 *  data for on-demand windows ("today" / custom), not just the nightly presets. */
async function fetchDailySpend(
  actId: string,
  token: string,
  spec: TimeSpec,
): Promise<{ daily: Record<string, number>; dailyRev: Record<string, number> }> {
  const daily: Record<string, number> = {};
  const dailyRev: Record<string, number> = {};
  type Row = {
    date_start?: string;
    spend?: string;
    purchase_roas?: { action_type: string; value: string }[];
  };
  const rows = await graphGetAll<Row>(
    `/${actId}/insights`,
    { level: "account", fields: "spend,purchase_roas", time_increment: 1, ...timeParams(spec) },
    token,
  );
  for (const r of rows) {
    if (!r.date_start) continue;
    const spend = r.spend ? parseFloat(r.spend) : 0;
    const roas = r.purchase_roas?.length ? parseFloat(r.purchase_roas[0].value) : 0;
    daily[r.date_start] = (daily[r.date_start] ?? 0) + spend;
    dailyRev[r.date_start] = (dailyRev[r.date_start] ?? 0) + spend * roas;
  }
  return { daily, dailyRev };
}

/** Account-level spend + revenue by hour-of-day for the window (one call), as two
 *  24-length arrays. Used for the "today" range, where the daily chart switches to
 *  hourly bars (a single day makes a day-granular chart useless). */
async function fetchHourly(
  actId: string,
  token: string,
  spec: TimeSpec,
): Promise<{ hourlySpend: number[]; hourlyRev: number[] }> {
  const hourlySpend = Array.from({ length: 24 }, () => 0);
  const hourlyRev = Array.from({ length: 24 }, () => 0);
  type Row = {
    hourly_stats_aggregated_by_advertiser_time_zone?: string;
    spend?: string;
    purchase_roas?: { action_type: string; value: string }[];
  };
  const rows = await graphGetAll<Row>(
    `/${actId}/insights`,
    {
      level: "account",
      fields: "spend,purchase_roas",
      breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
      ...timeParams(spec),
    },
    token,
  );
  for (const r of rows) {
    const h = hourIndex24(r.hourly_stats_aggregated_by_advertiser_time_zone ?? "");
    if (h < 0) continue;
    const spend = r.spend ? parseFloat(r.spend) : 0;
    const roas = r.purchase_roas?.length ? parseFloat(r.purchase_roas[0].value) : 0;
    hourlySpend[h] += spend;
    hourlyRev[h] += spend * roas;
  }
  return { hourlySpend, hourlyRev };
}

export async function syncRange(
  spec: TimeSpec,
  onProgress?: (p: { stage: string; pct: number }) => void,
): Promise<RangeSyncResult> {
  const token = await getActiveToken();
  const allow = (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const targets = (await gatherAccounts(token)).filter(
    (a) => !allow.length || allow.includes(`act_${a.account_id}`),
  );
  const result: RangeSyncResult = { window: spec.key, accounts: 0, campaigns: 0, creatives: 0, errors: [] };
  const total = Math.max(1, targets.length);

  // Preload DB once (avoids per-row round-trips inside the loop).
  const accountByActId = new Map(
    (await prisma.adAccount.findMany()).map((a) => [a.metaAccountId, a]),
  );
  const campByMetaId = new Map(
    (
      await prisma.campaign.findMany({
        select: { id: true, metaCampaignId: true, adAccountId: true, dailyBudgetMinor: true },
      })
    ).map((c) => [c.metaCampaignId, c]),
  );
  const creativeByMetaId = new Map(
    (await prisma.creative.findMany({ select: { id: true, metaCreativeId: true } })).map(
      (c) => [c.metaCreativeId, c.id],
    ),
  );

  let done = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const a = targets[cursor++];
      const actId = `act_${a.account_id}`;
      const account = accountByActId.get(actId);
      try {
        if (!account) continue; // never synced — run a full sync first

        // Meta calls in parallel: per-campaign insights, account daily spend, the
        // ad-level pass (ad→creative map + ad insights) that powers per-creative
        // metrics, and — for "today" only — an hourly spend/revenue series.
        const isToday = spec.key === "today";
        const [insights, { daily, dailyRev }, ads, adIns, hourly, campMeta, adsetBudgets] =
          await Promise.all([
            graphGet<{ data: CampRow[] }>(
              `/${actId}/insights`,
              { level: "campaign", fields: INSIGHT_FIELDS, limit: 500, ...timeParams(spec) },
              token,
            ),
            fetchDailySpend(actId, token, spec).catch(() => ({ daily: {}, dailyRev: {} })),
            graphGetAll<AdLite>(`/${actId}/ads`, { fields: AD_CREATIVE_FIELDS, limit: 500 }, token).catch(
              () => [] as AdLite[],
            ),
            graphGetAll<MetaInsightRow>(
              `/${actId}/insights`,
              { level: "ad", fields: AD_INSIGHT_FIELDS, limit: 500, ...timeParams(spec) },
              token,
            ).catch(() => [] as MetaInsightRow[]),
            isToday
              ? fetchHourly(actId, token, spec).catch(() => ({ hourlySpend: [], hourlyRev: [] }))
              : Promise.resolve({ hourlySpend: [] as number[], hourlyRev: [] as number[] }),
            // Budget is window-independent but only the full nightly sync refreshed it,
            // so an on-demand range (e.g. "Today") showed stale/฿0 budgets after an edit
            // in Business Suite. Refresh it here too: campaign-level (CBO) + ad-set sums.
            graphGetAll<CampMeta>(`/${actId}/campaigns`, { fields: "id,daily_budget" }, token).catch(
              () => [] as CampMeta[],
            ),
            fetchAdSetDailyBudgets(actId, token).catch(() => new Map<string, number>()),
          ]);

        // Map insight rows → snapshot rows for campaigns we already know.
        const rows = (insights.data ?? []).filter((r) => r.campaign_id && campByMetaId.has(r.campaign_id));
        const campIds = [...campByMetaId.values()]
          .filter((c) => c.adAccountId === account.id)
          .map((c) => c.id);

        // One deleteMany + one createMany for the whole account.
        if (campIds.length) {
          await prisma.insightSnapshot.deleteMany({
            where: { level: "CAMPAIGN", window: spec.key, campaignId: { in: campIds } },
          });
        }
        if (rows.length) {
          await prisma.insightSnapshot.createMany({
            data: rows.map((r) => ({
              level: "CAMPAIGN" as const,
              window: spec.key,
              campaignId: campByMetaId.get(r.campaign_id!)!.id,
              ...insightMetrics(r),
              fetchedAt: new Date(),
            })),
          });
          result.campaigns += rows.length;
        }

        // Refresh daily budgets for this account's known campaigns (campaign-level CBO,
        // else summed active ad sets). Only write the ones that actually changed, grouped
        // by value so it's a handful of updateMany calls, not one round-trip per campaign.
        const changedByBudget = new Map<number, string[]>();
        for (const cm of campMeta) {
          const local = campByMetaId.get(cm.id);
          if (!local || local.adAccountId !== account.id) continue;
          const minor = effectiveDailyBudget(cm.daily_budget, adsetBudgets.get(cm.id));
          if (minor === local.dailyBudgetMinor) continue;
          (changedByBudget.get(minor) ?? changedByBudget.set(minor, []).get(minor)!).push(local.id);
          local.dailyBudgetMinor = minor; // keep the cache in sync for later accounts/reads
        }
        for (const [minor, ids] of changedByBudget) {
          await prisma.campaign.updateMany({ where: { id: { in: ids } }, data: { dailyBudgetMinor: minor } });
        }

        // Daily (and, for "today", hourly) spend + revenue series → BreakdownSnapshot
        // (powers the Overview chart, both Spend and Revenue toggles).
        const bdData = isToday
          ? { daily, dailyRev, hourlySpend: hourly.hourlySpend, hourlyRev: hourly.hourlyRev }
          : { daily, dailyRev };
        await prisma.breakdownSnapshot.upsert({
          where: { adAccountId_window: { adAccountId: account.id, window: spec.key } },
          update: { data: bdData, fetchedAt: new Date() },
          create: { adAccountId: account.id, window: spec.key, data: bdData, fetchedAt: new Date() },
        });

        // Creative pass: fold ad-level insights into per-creative snapshots for this
        // window. Audience is left unset here (30d-derived; the read-APIs fall back to
        // the last_30d snapshot). Only creatives already known from a full sync update.
        const adToCreative = new Map<string, string>(); // ad_id → metaCreativeId
        for (const ad of ads) if (ad.id && ad.creative?.id) adToCreative.set(ad.id, ad.creative.id);
        const rowsByCreative = new Map<string, MetaInsightRow[]>();
        for (const r of adIns) {
          const metaCreativeId = r.ad_id ? adToCreative.get(r.ad_id) : undefined;
          const localId = metaCreativeId ? creativeByMetaId.get(metaCreativeId) : undefined;
          if (!localId) continue;
          (rowsByCreative.get(localId) ?? rowsByCreative.set(localId, []).get(localId)!).push(r);
        }
        const creativeIds = [...rowsByCreative.keys()];
        if (creativeIds.length) {
          await prisma.insightSnapshot.deleteMany({
            where: { level: "CREATIVE", window: spec.key, creativeId: { in: creativeIds } },
          });
          const snapRows = [];
          for (const [creativeId, rws] of rowsByCreative) {
            const agg = aggregateInsights(rws);
            if (agg.impressions <= 0) continue;
            const { video, engagement, ...kpis } = agg;
            snapRows.push({
              level: "CREATIVE" as const,
              window: spec.key,
              creativeId,
              ...kpis,
              video,
              engagement,
              fetchedAt: new Date(),
            });
          }
          if (snapRows.length) {
            await prisma.insightSnapshot.createMany({ data: snapRows });
            result.creatives += snapRows.length;
          }
        }
        result.accounts++;
      } catch (e) {
        result.errors.push(`${actId}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        done++;
        onProgress?.({ stage: `${done}/${targets.length} บัญชี · accounts`, pct: Math.round((done / total) * 100) });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  onProgress?.({ stage: "เสร็จสิ้น · Done", pct: 100 });
  return result;
}
