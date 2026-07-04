import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { graphGet, graphBatch, MetaApiError } from "./client";

const fetchMock = vi.fn();

/** Build a Graph-style JSON Response, optionally with a BUC usage header. */
function graphRes(
  body: unknown,
  init?: { status?: number; usage?: { pct?: number; regainSec?: number } },
): Response {
  const headers = new Headers();
  if (init?.usage) {
    headers.set(
      "x-business-use-case-usage",
      JSON.stringify({
        "123": [
          {
            call_count: init.usage.pct ?? 0,
            total_cputime: 0,
            total_time: 0,
            ...(init.usage.regainSec ? { estimated_time_to_regain_access: init.usage.regainSec } : {}),
          },
        ],
      }),
    );
  }
  return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers });
}

const throttled = (code: number) =>
  graphRes({ error: { message: `throttle ${code}`, code } }, { status: 400 });

/** Run a client call under fake timers, auto-advancing through backoff sleeps. */
async function withFakeTime<T>(p: Promise<T>): Promise<T> {
  // Attach a no-op catch first so a rejection during timer advancement is never unhandled.
  const settled = p.catch((e: unknown) => ({ __err: e }));
  await vi.runAllTimersAsync();
  const r = await settled;
  if (r && typeof r === "object" && "__err" in (r as object)) throw (r as { __err: unknown }).__err;
  return r as T;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("withRetry via graphGet", () => {
  it("retries a 613 throttle then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(throttled(613))
      .mockResolvedValueOnce(graphRes({ data: [{ id: "1" }] }));
    const res = await withFakeTime(graphGet<{ data: { id: string }[] }>("/act_1/campaigns", {}, "T"));
    expect(res.data).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries BUC code 80004 and 5xx without a Graph body", async () => {
    fetchMock
      .mockResolvedValueOnce(graphRes({ error: { message: "buc", code: 80004 } }, { status: 400 }))
      .mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }))
      .mockResolvedValueOnce(graphRes({ ok: true }));
    const res = await withFakeTime(graphGet<{ ok: boolean }>("/x", {}, "T"));
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a permanent error (code 100)", async () => {
    fetchMock.mockResolvedValue(graphRes({ error: { message: "bad field", code: 100 } }, { status: 400 }));
    await expect(withFakeTime(graphGet("/x", {}, "T"))).rejects.toThrow(/bad field/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 tries and throws the last error", async () => {
    // fresh Response per call — a body can only be consumed once
    fetchMock.mockImplementation(async () => throttled(17));
    await expect(withFakeTime(graphGet("/x", {}, "T"))).rejects.toThrow(/throttle 17/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails fast when Meta's regain hint exceeds 60s (no pointless retry)", async () => {
    fetchMock.mockImplementation(async () =>
      graphRes({ error: { message: "hard throttle", code: 17 } }, { status: 400, usage: { pct: 100, regainSec: 300 } }),
    );
    const err = await withFakeTime(graphGet("/x", {}, "T")).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as MetaApiError).retryAfterMs).toBe(300_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("soft-paces (sleeps) when BUC usage is at 80% but still resolves", async () => {
    fetchMock.mockResolvedValueOnce(graphRes({ ok: true }, { usage: { pct: 80 } }));
    const p = graphGet<{ ok: boolean }>("/x", {}, "T");
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(false); // still inside the 1s pacing sleep
    await vi.advanceTimersByTimeAsync(600);
    expect(done).toBe(true);
    expect((await p).ok).toBe(true);
  });
});

describe("graphBatch", () => {
  const item = (body: unknown, code = 200) => ({ code, body: JSON.stringify(body) });

  it("chunks 120 requests into 3 HTTP calls, preserving order", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(new URLSearchParams(init.body as string).get("batch")!) as unknown[];
      return graphRes(batch.map((_, i) => item({ n: i })));
    });
    const reqs = Array.from({ length: 120 }, (_, i) => ({
      method: "GET" as const,
      relative_url: `${i}?fields=id`,
    }));
    const res = await withFakeTime(graphBatch<{ n: number }>(reqs, "T"));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res).toHaveLength(120);
    expect(res.every((r) => r.ok)).toBe(true);
    // per-chunk order preserved (indices restart per chunk in this mock)
    expect(res[0].data).toEqual({ n: 0 });
    expect(res[49].data).toEqual({ n: 49 });
    expect(res[50].data).toEqual({ n: 0 });
  });

  it("isolates per-sub-request errors and maps null items to errors", async () => {
    fetchMock.mockResolvedValueOnce(
      graphRes([
        item({ success: true }),
        item({ error: { message: "no permission", code: 200 } }, 403),
        null,
      ]),
    );
    const res = await withFakeTime(
      graphBatch(
        [
          { method: "POST", relative_url: "111", body: "status=PAUSED" },
          { method: "POST", relative_url: "222", body: "daily_budget=30000" },
          { method: "GET", relative_url: "333" },
        ],
        "T",
      ),
    );
    expect(res[0]).toMatchObject({ ok: true, status: 200 });
    expect(res[1]).toMatchObject({ ok: false, status: 403, error: "no permission" });
    expect(res[2]).toMatchObject({ ok: false, status: 0, error: /not completed/ as unknown as string });
    expect(res[2].error).toMatch(/not completed/);
  });

  it("sends batch as form-encoded with include_headers=false", async () => {
    fetchMock.mockResolvedValueOnce(graphRes([item({ ok: 1 })]));
    await withFakeTime(graphBatch([{ method: "GET", relative_url: "1" }], "TOKEN"));
    const form = new URLSearchParams(fetchMock.mock.calls[0][1].body as string);
    expect(form.get("access_token")).toBe("TOKEN");
    expect(form.get("include_headers")).toBe("false");
    expect(JSON.parse(form.get("batch")!)).toEqual([{ method: "GET", relative_url: "1" }]);
  });
});
