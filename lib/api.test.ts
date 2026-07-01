import { describe, it, expect, vi, afterEach } from "vitest";
import { streamMetaSync } from "./api";

/** Build a Response whose body streams the given strings as UTF-8 chunks. */
function streamResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe("streamMetaSync", () => {
  it("emits each progress event and resolves with the done result", async () => {
    const lines = [
      JSON.stringify({ type: "progress", stage: "accounts", pct: 2 }) + "\n",
      JSON.stringify({ type: "progress", stage: "campaigns", pct: 40 }) + "\n",
      JSON.stringify({ type: "done", result: { accounts: 2, campaigns: 9, errors: [] } }) + "\n",
    ];
    // split a line across chunk boundaries to exercise the buffering
    const chunks = [lines[0] + lines[1].slice(0, 6), lines[1].slice(6) + lines[2]];
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(chunks)));

    const seen: { stage: string; pct: number }[] = [];
    const result = await streamMetaSync((p) => seen.push(p));

    expect(seen).toEqual([
      { stage: "accounts", pct: 2 },
      { stage: "campaigns", pct: 40 },
    ]);
    expect(result.accounts).toBe(2);
    expect(result.campaigns).toBe(9);
  });

  it("throws when the stream sends an error event", async () => {
    const chunks = [JSON.stringify({ type: "error", error: "No Meta token" }) + "\n"];
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(chunks)));
    await expect(streamMetaSync(() => {})).rejects.toThrow(/No Meta token/);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(streamMetaSync(() => {})).rejects.toThrow(/500/);
  });
});
