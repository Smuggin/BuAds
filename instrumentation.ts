/**
 * Server background poller (runs once on server boot). Mirrors Meta campaign on/off
 * status into the cache every ~120s so the dashboard tracks Business Suite without a
 * manual sync. Long-running node only (`next dev` / `next start`); on Vercel
 * serverless use a vercel.json cron hitting POST /api/sync/status instead.
 *
 * Disable with META_STATUS_POLL=off; tune cadence with META_STATUS_POLL_SECONDS.
 */
declare global {
  var __statusPoller: NodeJS.Timeout | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((process.env.META_STATUS_POLL ?? "on").toLowerCase() === "off") return;
  if (globalThis.__statusPoller) return; // guard against dev HMR double-start

  const seconds = Number(process.env.META_STATUS_POLL_SECONDS ?? 120);
  const intervalMs = Math.max(30, seconds) * 1000;

  const { syncCampaignStatuses } = await import("@/lib/meta/statusSync");
  globalThis.__statusPoller = setInterval(() => {
    syncCampaignStatuses().catch((e) => console.error("[status-poll]", e));
  }, intervalMs);

  console.log(`[status-poll] campaign on/off mirror every ${intervalMs / 1000}s`);
}
