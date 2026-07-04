/**
 * Lightweight, near-realtime status mirror. Polls only `id,status,effective_status`
 * per campaign (no insights, no auto-close, no writes back to Meta) and updates the
 * on/off status of campaigns already in the cache — so the dashboard tracks Meta
 * Business Suite. Cheap enough to run every ~120s. Server-only.
 */
import { prisma } from "@/lib/db";
import { graphGetAll } from "./client";
import { getActiveToken } from "./auth";
import { toAdStatus } from "./map";

interface MetaCampaignStatus {
  id: string;
  status?: string;
  effective_status?: string;
}

export interface StatusSyncResult {
  accounts: number;
  updated: number;
  errors: string[];
}

export async function syncCampaignStatuses(): Promise<StatusSyncResult> {
  const token = await getActiveToken();
  const result: StatusSyncResult = { accounts: 0, updated: 0, errors: [] };

  const allow = (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Targets come from the AdAccount mirror, NOT gatherAccounts() — this poller
  // runs every ~120s plus on every tab focus, and the identity walk cost 3–8
  // Graph calls each time for accounts we already know. New accounts enter the
  // mirror via the full sync (runSync), which still gathers live.
  for (const acc of await prisma.adAccount.findMany({ select: { metaAccountId: true } })) {
    const actId = acc.metaAccountId;
    if (allow.length && !allow.includes(actId)) continue;
    try {
      const rows = await graphGetAll<MetaCampaignStatus>(
        `/${actId}/campaigns`,
        { fields: "id,status,effective_status" },
        token,
      );
      const existing = await prisma.campaign.findMany({
        where: { adAccount: { metaAccountId: actId } },
        select: { metaCampaignId: true, status: true, effectiveStatus: true, statusSource: true },
      });
      const byId = new Map(existing.map((c) => [c.metaCampaignId, c]));
      result.accounts++;

      for (const row of rows) {
        const ex = byId.get(row.id);
        if (!ex) continue; // unseen campaign — waits for the next full sync (needs insights)
        const metaStatus = toAdStatus(row.status);
        const effectiveStatus = row.effective_status ?? null;
        if (metaStatus === ex.status && effectiveStatus === ex.effectiveStatus) continue;
        // Preserve our AUTO/MANUAL marker while the on/off is unchanged; a real toggle resets to META.
        const statusSource = ex.status === metaStatus ? ex.statusSource : "META";
        await prisma.campaign.update({
          where: { metaCampaignId: row.id },
          data: { status: metaStatus, effectiveStatus, statusSource },
        });
        result.updated++;
      }
    } catch (e) {
      result.errors.push(`${actId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
