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
import { insightMetrics, type MetaInsightRow } from "./map";
import { timeParams, type TimeSpec } from "@/lib/windows";

type CampRow = MetaInsightRow & { campaign_id?: string };

export interface RangeSyncResult {
  window: string;
  accounts: number;
  campaigns: number;
  errors: string[];
}

const CONCURRENCY = 6;

/** Account-level daily spend for the window (one call), keyed by ISO date. */
async function fetchDailySpend(
  actId: string,
  token: string,
  spec: TimeSpec,
): Promise<Record<string, number>> {
  const daily: Record<string, number> = {};
  const rows = await graphGetAll<{ date_start?: string; spend?: string }>(
    `/${actId}/insights`,
    { level: "account", fields: "spend", time_increment: 1, ...timeParams(spec) },
    token,
  );
  for (const r of rows) {
    if (r.date_start) daily[r.date_start] = (daily[r.date_start] ?? 0) + (r.spend ? parseFloat(r.spend) : 0);
  }
  return daily;
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
  const result: RangeSyncResult = { window: spec.key, accounts: 0, campaigns: 0, errors: [] };
  const total = Math.max(1, targets.length);

  // Preload DB once (avoids per-campaign round-trips inside the loop).
  const accountByActId = new Map(
    (await prisma.adAccount.findMany()).map((a) => [a.metaAccountId, a]),
  );
  const campByMetaId = new Map(
    (await prisma.campaign.findMany({ select: { id: true, metaCampaignId: true, adAccountId: true } })).map(
      (c) => [c.metaCampaignId, c],
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

        // Two Meta calls in parallel: per-campaign insights + account daily spend.
        const [insights, daily] = await Promise.all([
          graphGet<{ data: CampRow[] }>(
            `/${actId}/insights`,
            { level: "campaign", fields: INSIGHT_FIELDS, limit: 500, ...timeParams(spec) },
            token,
          ),
          fetchDailySpend(actId, token, spec).catch(() => ({}) as Record<string, number>),
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

        // Daily-spend series → BreakdownSnapshot (powers the Overview daily chart).
        await prisma.breakdownSnapshot.upsert({
          where: { adAccountId_window: { adAccountId: account.id, window: spec.key } },
          update: { data: { daily }, fetchedAt: new Date() },
          create: { adAccountId: account.id, window: spec.key, data: { daily }, fetchedAt: new Date() },
        });
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
