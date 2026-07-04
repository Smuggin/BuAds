/**
 * Durable sync state on top of the SyncRun table (one row per kind).
 *
 * A sync no longer lives inside a streamed response: the route claims the row
 * (atomic conditional update — two tabs can never both win), detaches the work
 * with next/server's after(), and the client polls GET /api/sync/state. The row
 * carries progress (pct/stage), the final counts, and a heartbeat (`updatedAt`)
 * so a run killed by the platform is detected as stale instead of wedging the
 * lock forever. Server-only.
 */
import { Prisma } from "@prisma/client";
import type { SyncRun } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SyncKind = "full" | "map" | "range" | "status";

/** A "running" row older than this is considered dead (route maxDuration 120s + slack). */
export const STALE_MS = 3 * 60_000;

export interface SyncRunDto {
  kind: string;
  rangeKey: string | null;
  status: string; // idle | running | done | error
  pct: number;
  stage: string;
  counts: unknown;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
  stale: boolean; // running but heartbeat stopped — treat as dead
}

function toDto(r: SyncRun): SyncRunDto {
  return {
    kind: r.kind,
    rangeKey: r.rangeKey,
    status: r.status,
    pct: r.pct,
    stage: r.stage,
    counts: r.counts,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    stale: r.status === "running" && r.updatedAt.getTime() < Date.now() - STALE_MS,
  };
}

/**
 * Try to claim the sync lock for `kind`. Returns { claimed: false } when a live
 * run is already in flight (the caller should adopt its progress instead of
 * starting a duplicate). Stale runs are reclaimed.
 */
export async function claimSyncRun(
  kind: SyncKind,
  rangeKey?: string,
): Promise<{ claimed: boolean; run: SyncRunDto }> {
  // Ensure the row exists without touching a running one.
  await prisma.syncRun.createMany({ data: [{ kind }], skipDuplicates: true });
  const staleCutoff = new Date(Date.now() - STALE_MS);
  // Atomic claim: Postgres row locking serializes concurrent updateMany calls,
  // so exactly one caller sees count === 1.
  const { count } = await prisma.syncRun.updateMany({
    where: { kind, OR: [{ status: { not: "running" } }, { updatedAt: { lt: staleCutoff } }] },
    data: {
      status: "running",
      rangeKey: rangeKey ?? null,
      pct: 0,
      stage: "เริ่มซิงค์ · Starting…",
      counts: Prisma.DbNull,
      error: null,
      startedAt: new Date(),
      finishedAt: null,
    },
  });
  const run = await prisma.syncRun.findUniqueOrThrow({ where: { kind } });
  return { claimed: count === 1, run: toDto(run) };
}

/**
 * Progress writer compatible with runSync/syncRange's onProgress. Throttled to
 * one DB write per ~2s and fire-and-forget — a DB hiccup must never sink the
 * sync itself. Each write refreshes `updatedAt`, doubling as the heartbeat.
 */
export function makeRunProgressWriter(kind: SyncKind): (p: { stage: string; pct: number }) => void {
  let last = 0;
  return (p) => {
    const now = Date.now();
    if (now - last < 2_000) return;
    last = now;
    void prisma.syncRun
      .updateMany({
        where: { kind, status: "running" },
        // cap at 99 — 100 is reserved for finishSyncRun
        data: { pct: Math.min(99, Math.max(0, Math.round(p.pct))), stage: p.stage },
      })
      .catch(() => {});
  };
}

/** Mark the run finished. Stores the full result under `counts` (the client
 *  reads it back as the sync summary). Never throws. */
export async function finishSyncRun(
  kind: SyncKind,
  outcome: { counts?: unknown; error?: string },
): Promise<void> {
  try {
    await prisma.syncRun.updateMany({
      where: { kind },
      data: outcome.error
        ? { status: "error", error: outcome.error, finishedAt: new Date() }
        : {
            status: "done",
            pct: 100,
            stage: "เสร็จสิ้น · Done",
            counts: (outcome.counts ?? Prisma.DbNull) as Prisma.InputJsonValue,
            error: null,
            finishedAt: new Date(),
          },
    });
  } catch {
    /* last-resort: never throw from inside after() */
  }
}

/** All sync rows (≤4) with the computed stale flag — the poll endpoint's payload. */
export async function getSyncRuns(): Promise<SyncRunDto[]> {
  const rows = await prisma.syncRun.findMany();
  return rows.map(toDto);
}
