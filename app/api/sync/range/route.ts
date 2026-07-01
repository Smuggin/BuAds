/**
 * On-demand streaming sync for "today" / custom ranges. Same NDJSON protocol as
 * /api/sync/stream. Query: ?range=today|custom[&since=YYYY-MM-DD&until=YYYY-MM-DD].
 * Custom spans are clamped to MAX_RANGE_DAYS. Auth-gated.
 */
import { syncRange } from "@/lib/meta/syncRange";
import { rangeToSpec, MAX_RANGE_DAYS } from "@/lib/windows";
import { requireAuth } from "@/lib/auth/guard";

/** Raw inclusive day count (unclamped) — for enforcing the range cap. */
const rawSpanDays = (since: string, until: string) =>
  Math.floor((Date.parse(until) - Date.parse(since)) / 86_400_000) + 1;

export const maxDuration = 120;

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await syncRange(spec, (p) => send({ type: "progress", ...p }));
        send({ type: "done", result });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
