/**
 * Manual full sync, detached. (Path kept from the old NDJSON streaming design to
 * minimize the diff — it no longer streams.)
 *
 * Claims the SyncRun lock, runs runSync() inside after() so it survives the
 * client disconnecting, and returns immediately. Progress + the final result
 * land on the SyncRun row, polled via GET /api/sync/state. A second caller gets
 * { alreadyRunning: true } and adopts the in-flight run.
 * Auth-gated like the non-detached /api/sync.
 */
import { after } from "next/server";
import { runSync } from "@/lib/meta/sync";
import { claimSyncRun, finishSyncRun, makeRunProgressWriter } from "@/lib/meta/syncState";
import { requireAuth } from "@/lib/auth/guard";

export const maxDuration = 120; // the after() work counts toward this budget

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;

  const { claimed, run } = await claimSyncRun("full");
  if (!claimed) return Response.json({ alreadyRunning: true, run });

  after(async () => {
    try {
      const result = await runSync({ onProgress: makeRunProgressWriter("full") });
      await finishSyncRun("full", { counts: result });
    } catch (e) {
      await finishSyncRun("full", { error: e instanceof Error ? e.message : String(e) });
    }
  });

  return Response.json({ started: true, run });
}
