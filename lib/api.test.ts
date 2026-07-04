import { describe, it, expect, vi, afterEach } from "vitest";
import { startFullSync, startRangeSync, getSyncState, type SyncRunDto } from "./api";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const run = (over: Partial<SyncRunDto> = {}): SyncRunDto => ({
  kind: "full",
  rangeKey: null,
  status: "running",
  pct: 0,
  stage: "เริ่มซิงค์ · Starting…",
  counts: null,
  error: null,
  startedAt: "2026-07-04T00:00:00.000Z",
  finishedAt: null,
  updatedAt: "2026-07-04T00:00:00.000Z",
  stale: false,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("start sync protocol", () => {
  it("startFullSync resolves with the started run", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ started: true, run: run() }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await startFullSync();
    expect(res.started).toBe(true);
    expect(res.run.kind).toBe("full");
    expect(fetchMock).toHaveBeenCalledWith("/api/sync/stream", { method: "POST" });
  });

  it("surfaces alreadyRunning so the caller adopts the in-flight run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ alreadyRunning: true, run: run({ pct: 40 }) })));
    const res = await startFullSync();
    expect(res.alreadyRunning).toBe(true);
    expect(res.run.pct).toBe(40);
  });

  it("throws the server error message on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ error: "No Meta token" }, 400)));
    await expect(startFullSync()).rejects.toThrow(/No Meta token/);
  });

  it("startRangeSync passes range + custom dates in the query", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ started: true, run: run({ kind: "range", rangeKey: "custom" }) }));
    vi.stubGlobal("fetch", fetchMock);
    await startRangeSync("custom", { since: "2026-07-01", until: "2026-07-03" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync/range?range=custom&since=2026-07-01&until=2026-07-03",
      { method: "POST" },
    );
  });
});

describe("getSyncState", () => {
  it("returns the sync rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes([run({ status: "done", pct: 100 })])),
    );
    const rows = await getSyncState();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("done");
  });
});
