/**
 * Sync status poll point: all SyncRun rows (≤4 — one per kind) with a computed
 * `stale` flag. The client polls this every ~2.5s ONLY while a sync is known to
 * be running; it is a single cheap SELECT. Auth-gated.
 */
import { NextResponse } from "next/server";
import { getSyncRuns } from "@/lib/meta/syncState";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json(await getSyncRuns());
}
