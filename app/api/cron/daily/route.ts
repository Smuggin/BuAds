import { NextResponse } from "next/server";
import { runSync } from "@/lib/meta/sync";
import { resetCampaignBudgets } from "@/lib/rules/budgetReset";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

// Vercel cron sends `Authorization: Bearer $CRON_SECRET`. Reject anything else
// when the secret is configured (this route is excluded from the session guard).
function denyUnlessCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // not configured (e.g. local dev) — allow
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`
    ? null
    : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Drop expired session rows (housekeeping piggybacked on the nightly job). */
async function cleanupSessions() {
  return prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .then((r) => r.count)
    .catch(() => 0);
}

/** Nightly job (midnight Bangkok): reset campaign budgets to ฿300, then the light
 *  discover+group sync. Budget reset runs first (time-sensitive). */
export async function POST(req: Request) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;
  try {
    const budget = await resetCampaignBudgets();
    const map = await runSync({ mode: "map" });
    const sessionsPurged = await cleanupSessions();
    return NextResponse.json({ budget, map, sessionsPurged });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron triggers via GET. `?dry=1` runs the budget reset in dry-run mode
 *  (counts only, NO writes, skips the sync) — for safe manual verification. */
export async function GET(req: Request) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;
  if (new URL(req.url).searchParams.get("dry") === "1") {
    try {
      return NextResponse.json({ budget: await resetCampaignBudgets({ dryRun: true }) });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  return POST(req);
}
