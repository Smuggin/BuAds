import { NextResponse } from "next/server";
import { runSync } from "@/lib/meta/sync";
import { resetCampaignBudgets } from "@/lib/rules/budgetReset";

export const maxDuration = 60;

/** Nightly job (midnight Bangkok): reset campaign budgets to ฿300, then the light
 *  discover+group sync. Budget reset runs first (time-sensitive). */
export async function POST() {
  try {
    const budget = await resetCampaignBudgets();
    const map = await runSync({ mode: "map" });
    return NextResponse.json({ budget, map });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron triggers via GET. `?dry=1` runs the budget reset in dry-run mode
 *  (counts only, NO writes, skips the sync) — for safe manual verification. */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("dry") === "1") {
    try {
      return NextResponse.json({ budget: await resetCampaignBudgets({ dryRun: true }) });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  return POST();
}
