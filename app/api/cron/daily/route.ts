import { after, NextResponse } from "next/server";
import { runSync } from "@/lib/meta/sync";
import { resetCampaignBudgets, BUDGET_RULE_ID, type BudgetResetResult } from "@/lib/rules/budgetReset";
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

/**
 * Persist ONE durable Activity-Log entry per nightly run — success, no-op, or
 * failure — so every cron execution is visible in-app (Vercel's own function logs
 * have very short retention on Hobby). The `detail` is a concise bilingual headline;
 * the full per-account breakdown + errors + sync counts live in `afterVal` as JSON.
 * Never throws — logging must not turn a successful reset into a 500.
 */
async function logCronRun(input: {
  budget?: BudgetResetResult;
  map?: unknown;
  error?: string;
}): Promise<void> {
  const { budget, map, error } = input;
  const parts: string[] = [];
  if (error) parts.push(`ล้มเหลว · FAILED: ${error}`);
  if (budget) {
    parts.push(
      `รีเซ็ต ${budget.campaignsReset} แคมเปญ + ${budget.adsetsReset} ad set → ฿${budget.target}`,
    );
    parts.push(`ข้าม ${budget.skipped}`);
    if (budget.errors.length) parts.push(`error ${budget.errors.length}`);
  }
  const detail = parts.join(" · ") || "no-op";
  const afterVal = JSON.stringify({ budget, map, error }).slice(0, 4000);
  await prisma.activityLog
    .create({
      data: {
        actor: "AUTO",
        // FK-safe: only reference the rule row when the reset actually ran (it upserts the row).
        ruleId: budget ? BUDGET_RULE_ID : null,
        type: "BUDGET_DOWN",
        title: error
          ? "ครอนกลางคืนล้มเหลว · Nightly cron failed"
          : "รีเซ็ตงบ ฿300 · Nightly budget reset",
        detail,
        afterVal,
      },
    })
    .catch(() => {});
}

/** Nightly job (midnight Bangkok): reset campaign + ad-set budgets to ฿300, then the
 *  light discover+group sync. Budget reset runs first (time-sensitive). Every run is
 *  recorded to the Activity Log via logCronRun(), including partial/complete failures. */
export async function POST(req: Request) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  // Do the work AFTER the response so the trigger gets an immediate 200 — external
  // schedulers (e.g. cron-job.org) drop the connection at a ~30s client timeout, and
  // the reset + map sync can run longer than that. The real outcome (incl. failures)
  // is captured in the Activity Log via logCronRun(), not in this response body.
  after(async () => {
    let budget: BudgetResetResult | undefined;
    let map: unknown;
    let error: string | undefined;
    try {
      budget = await resetCampaignBudgets();
      map = await runSync({ mode: "map" });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await cleanupSessions();
    await logCronRun({ budget, map, error });
  });

  return NextResponse.json({ started: true });
}

/** Vercel cron triggers via GET. `?dry=1` runs the budget reset in dry-run mode
 *  (counts only, NO writes, skips the sync, NO log) — for safe manual verification. */
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
