/**
 * Streaming manual sync: runs runSync() and streams NDJSON progress events so the
 * UI can show a staged progress bar. One JSON object per line:
 *   {type:"progress", stage, pct} · {type:"done", result} · {type:"error", error}
 * Auth-gated like the non-streaming /api/sync.
 */
import { runSync } from "@/lib/meta/sync";
import { requireAuth } from "@/lib/auth/guard";

export const maxDuration = 120;

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runSync({ onProgress: (p) => send({ type: "progress", ...p }) });
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
      Connection: "keep-alive",
    },
  });
}
