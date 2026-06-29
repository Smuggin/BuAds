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
