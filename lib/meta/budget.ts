/**
 * Daily-budget resolution shared by the full sync and the on-demand range sync.
 *
 * Meta stores a campaign's daily budget in one of two places:
 *  - Campaign Budget Optimization (CBO / Advantage campaign budget) → on the campaign
 *    (`campaign.daily_budget` is set).
 *  - Non-CBO → on each ad set; `campaign.daily_budget` is empty and every ad set carries
 *    its own `daily_budget`.
 * Meta Business Suite shows the EFFECTIVE daily budget: the campaign budget when CBO is
 * on, otherwise the sum of the ACTIVE ad sets' daily budgets. Reading only the campaign
 * edge (as we used to) left non-CBO campaigns showing ฿0. Server-only.
 */
import { graphGetAll } from "./client";

interface MetaAdSet { campaign_id?: string; status?: string; daily_budget?: string }

/**
 * Sum of ACTIVE ad-set daily budgets per campaign (minor units) for one account, in a
 * single paginated call. Paused ad sets don't spend, so they're excluded; lifetime-budget
 * ad sets have no `daily_budget` and contribute nothing. Keyed by metaCampaignId.
 */
export async function fetchAdSetDailyBudgets(
  actId: string,
  token: string,
): Promise<Map<string, number>> {
  const adsets = await graphGetAll<MetaAdSet>(
    `/${actId}/adsets`,
    { fields: "campaign_id,status,daily_budget", limit: 500 },
    token,
  );
  const byCampaign = new Map<string, number>();
  for (const s of adsets) {
    if (!s.campaign_id || !s.daily_budget) continue;
    if ((s.status ?? "").toUpperCase() !== "ACTIVE") continue;
    const minor = parseInt(s.daily_budget);
    if (!Number.isFinite(minor)) continue;
    byCampaign.set(s.campaign_id, (byCampaign.get(s.campaign_id) ?? 0) + minor);
  }
  return byCampaign;
}

/**
 * A campaign's effective daily budget (minor units): the campaign-level (CBO) budget if
 * set, else the summed ACTIVE ad-set budgets. Mirrors what Business Suite displays.
 */
export function effectiveDailyBudget(
  campaignDailyBudget: string | undefined,
  adsetSum: number | undefined,
): number {
  if (campaignDailyBudget) {
    const minor = parseInt(campaignDailyBudget);
    if (Number.isFinite(minor)) return minor;
  }
  return adsetSum ?? 0;
}
