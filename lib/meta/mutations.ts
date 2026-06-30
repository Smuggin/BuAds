/**
 * Meta write-backs (mutations). Server-only. Requires an `ads_management` token.
 * Pausing/resuming a campaign here reflects in Meta Business Suite.
 */
import { graphPost } from "./client";

/** Pause or resume a campaign in Meta. status ACTIVE = resume, PAUSED = pause. */
export async function setCampaignStatus(
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED",
  token: string,
): Promise<void> {
  await graphPost<{ success?: boolean }>(`/${metaCampaignId}`, { status }, token);
}

/** Set a campaign's daily budget in Meta. dailyBudgetMinor = THB×100 (฿300 = 30000).
 *  Errors for campaigns whose budget is at the ad-set level or is a lifetime budget. */
export async function setCampaignBudget(
  metaCampaignId: string,
  dailyBudgetMinor: number,
  token: string,
): Promise<void> {
  await graphPost<{ success?: boolean }>(`/${metaCampaignId}`, { daily_budget: dailyBudgetMinor }, token);
}
