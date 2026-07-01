/**
 * Meta write-backs (mutations). Server-only. Requires an `ads_management` token.
 * Pausing/resuming a campaign here reflects in Meta Business Suite.
 *
 * Every mutation is fail-closed: assertWriteAllowed() (writeGuard.ts) throws
 * unless the master switch is on AND the campaign belongs to an allowlisted
 * account. This is the single choke point for auto-close, budget-reset, and the
 * write-test endpoint alike.
 */
import { graphPost } from "./client";
import { assertWriteAllowed } from "./writeGuard";

/** Pause or resume a campaign in Meta. status ACTIVE = resume, PAUSED = pause. */
export async function setCampaignStatus(
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED",
  token: string,
): Promise<void> {
  await assertWriteAllowed(metaCampaignId);
  await graphPost<{ success?: boolean }>(`/${metaCampaignId}`, { status }, token);
}

/** Set a campaign's daily budget in Meta. dailyBudgetMinor = THB×100 (฿300 = 30000).
 *  Errors for campaigns whose budget is at the ad-set level or is a lifetime budget.
 *
 *  Budget-ONLY: the request body carries `daily_budget` and nothing else — no `status`
 *  is ever sent, so the campaign's on/off state in Meta is left exactly as-is (active
 *  stays active, paused stays paused). This is a hard invariant the nightly reset relies
 *  on; do not add other fields here. */
export async function setCampaignBudget(
  metaCampaignId: string,
  dailyBudgetMinor: number,
  token: string,
): Promise<void> {
  await assertWriteAllowed(metaCampaignId);
  // Frozen single-key body — guarantees we never co-send `status` (on/off) with a budget.
  const body = { daily_budget: dailyBudgetMinor } as const;
  await graphPost<{ success?: boolean }>(`/${metaCampaignId}`, body, token);
}
