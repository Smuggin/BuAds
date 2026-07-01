import { NextResponse } from "next/server";
import { runSync } from "@/lib/meta/sync";
import { requireAuth } from "@/lib/auth/guard";

export const maxDuration = 60;

/** Light scheduled pass: discover new campaigns, group each to its SKU, and
 *  refresh 30d campaign metrics. Skips the heavy creative/breakdown passes so it
 *  stays within serverless time limits. POST (manual) + GET (Vercel cron). */
export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const result = await runSync({ mode: "map" });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron triggers via GET. */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return POST();
}
