/**
 * Automation rule: reset every campaign's daily budget to ฿300. Runs nightly via
 * the daily cron (midnight Bangkok). Targets campaign-level daily budgets only —
 * ad-set-level and lifetime budgets can't take a campaign daily_budget write, so
 * they're counted as skipped. Gated by the rule's on/off (DB). Server-only.
 */
import { prisma } from "@/lib/db";
import { getActiveToken } from "@/lib/meta/auth";
import { gatherAccounts } from "@/lib/meta/sync";
import { graphGetAll } from "@/lib/meta/client";
import { setCampaignBudget } from "@/lib/meta/mutations";

export const BUDGET_RULE_ID = "rule_budget_reset";

/** Canonical rule row (also used by the seed + migration). */
export const BUDGET_RULE = {
  id: BUDGET_RULE_ID,
  name: "รีเซ็ตงบทุกแคมเปญ · Reset all budgets",
  scope: "ทุกแคมเปญ · All campaigns",
  ifCondition: "เที่ยงคืน เวลาไทย · midnight (Bangkok)",
  thenAction: "ตั้งงบ/วัน ฿300 · Set daily budget ฿300",
  type: "clock",
  tone: "#3b6fe0",
} as const;

const TARGET_THB = 300;
const TARGET_MINOR = TARGET_THB * 100; // ฿300 → 30000 minor units
const CONCURRENCY = 8;

export interface BudgetResetResult {
  dryRun: boolean;
  on: boolean;
  target: number; // THB
  reset: number; // campaigns set (or, in dry-run, that WOULD be set)
  skipped: number; // ad-set / lifetime budget campaigns (can't take a campaign daily_budget)
  errors: string[];
}

/** Ensure the rule row exists so the Automation page shows it and we can gate on it. */
async function ensureRule() {
  return prisma.rule.upsert({
    where: { id: BUDGET_RULE_ID },
    update: {},
    create: { ...BUDGET_RULE, runs: 0, on: true },
  });
}

interface MetaCampaign {
  id: string;
  name?: string;
  status?: string;
  daily_budget?: string;
}

export async function resetCampaignBudgets(opts: { dryRun?: boolean } = {}): Promise<BudgetResetResult> {
  const dryRun = !!opts.dryRun;
  const rule = await ensureRule();
  const result: BudgetResetResult = {
    dryRun,
    on: rule.on,
    target: TARGET_THB,
    reset: 0,
    skipped: 0,
    errors: [],
  };
  if (!rule.on) return result; // rule switched off — do nothing

  const token = await getActiveToken();
  const allow = (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // collect campaign-level-budget targets across all accounts
  const targets: string[] = [];
  for (const a of await gatherAccounts(token)) {
    const actId = `act_${a.account_id}`;
    if (allow.length && !allow.includes(actId)) continue;
    try {
      const camps = await graphGetAll<MetaCampaign>(
        `/${actId}/campaigns`,
        { fields: "id,name,status,daily_budget" },
        token,
      );
      for (const c of camps) {
        // active campaigns with a campaign-level daily budget; the rest are skipped
        // (paused/archived, or ad-set/lifetime budgets that can't take this write).
        if (c.daily_budget && (c.status ?? "").toUpperCase() === "ACTIVE") targets.push(c.id);
        else result.skipped++;
      }
    } catch (e) {
      result.errors.push(`${actId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (dryRun) {
    result.reset = targets.length; // count only — no writes
    return result;
  }

  // live writes — bounded concurrency to fit the 60s function limit
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const id = targets[i++];
      try {
        await setCampaignBudget(id, TARGET_MINOR, token);
        await prisma.campaign.updateMany({
          where: { metaCampaignId: id },
          data: { dailyBudgetMinor: TARGET_MINOR },
        });
        result.reset++;
      } catch (e) {
        result.errors.push(`budget ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  // bookkeeping: bump the rule + one summary activity-log entry
  await prisma.rule.update({
    where: { id: BUDGET_RULE_ID },
    data: { runs: { increment: 1 }, lastRunAt: new Date() },
  });
  await prisma.activityLog.create({
    data: {
      actor: "AUTO",
      ruleId: BUDGET_RULE_ID,
      type: "BUDGET_DOWN",
      title: "รีเซ็ตงบ ฿300 · Budget reset",
      detail: `${result.reset} แคมเปญ → ฿300`,
    },
  });
  return result;
}
