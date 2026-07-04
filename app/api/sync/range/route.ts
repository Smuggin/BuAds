/**
 * On-demand background sync for "today" / custom ranges.
 * Query: ?range=today|custom[&since=YYYY-MM-DD&until=YYYY-MM-DD].
 * Custom spans are clamped to MAX_RANGE_DAYS. Auth-gated.
 *
 * Claims the SyncRun lock, detaches the work with after() (survives the client
 * navigating away), and returns immediately — the client polls /api/sync/state
 * for progress. A second caller gets { alreadyRunning: true } and adopts the
 * in-flight run instead of duplicating Meta calls.
 */
import { after } from "next/server";
import { syncRange } from "@/lib/meta/syncRange";
import { claimSyncRun, finishSyncRun, makeRunProgressWriter } from "@/lib/meta/syncState";
import { rangeToSpec, MAX_RANGE_DAYS } from "@/lib/windows";
import { requireAuth } from "@/lib/auth/guard";

/** Raw inclusive day count (unclamped) — for enforcing the range cap. */
const rawSpanDays = (since: string, until: string) =>
  Math.floor((Date.parse(until) - Date.parse(since)) / 86_400_000) + 1;

export const maxDuration = 120; // the after() work counts toward this budget

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "today";
  const since = url.searchParams.get("since") ?? undefined;
  const until = url.searchParams.get("until") ?? undefined;

  if (range === "custom") {
    if (!since || !until) {
      return Response.json({ error: "since & until required for custom range" }, { status: 400 });
    }
    if (Date.parse(since) > Date.parse(until)) {
      return Response.json({ error: "since must be on or before until" }, { status: 400 });
    }
    if (rawSpanDays(since, until) > MAX_RANGE_DAYS) {
      return Response.json({ error: `range exceeds ${MAX_RANGE_DAYS} days` }, { status: 400 });
    }
  }

  const spec = rangeToSpec(range, since && until ? { since, until } : null);

  const { claimed, run } = await claimSyncRun("range", spec.key);
  if (!claimed) return Response.json({ alreadyRunning: true, run });

  after(async () => {
    try {
      const result = await syncRange(spec, makeRunProgressWriter("range"));
      await finishSyncRun("range", { counts: result });
    } catch (e) {
      await finishSyncRun("range", { error: e instanceof Error ? e.message : String(e) });
    }
  });

  return Response.json({ started: true, run });
}
