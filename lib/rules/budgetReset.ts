/**
 * Automation rule: reset a campaign's daily budget to ฿300. Runs nightly via the daily
 * cron (midnight Bangkok). Targets every campaign that was OPENED OR SCALED that day —
 * i.e. ACTIVE right now, OR paused now but with spend recorded for today (so a campaign
 * scaled up during the day and paused before midnight is back at ฿300 when reopened).
 * Resets BOTH:
 *   - campaign-level daily budgets (CBO / Advantage campaign budget), and
 *   - for eligible campaigns whose budget lives at the AD-SET level (ABO), each of their
 *     active/paused ad sets' daily budgets.
 * Archived/deleted campaigns and long-idle paused campaigns (no spend today) are skipped —
 * this deliberately avoids rewriting the hundreds of dormant paused campaigns per account.
 * Gated by the rule's on/off (DB) and the fail-closed write guard. Activity logging is
 * centralized in the cron route so every run — success, no-op, or failure — leaves one
 * durable record. Server-only.
 */
import { prisma } from "@/lib/db";
import { getActiveToken } from "@/lib/meta/auth";
import { gatherAccounts } from "@/lib/meta/sync";
import { graphGetAll } from "@/lib/meta/client";
import { setAdSetBudget, setCampaignBudget } from "@/lib/meta/mutations";

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

/** Per-account tally — surfaced in the run's activity-log entry for visibility. */
export interface AccountResetStat {
  actId: string;
  name: string;
  campaigns: number; // campaign-level budgets reset (or, in dry-run, that WOULD be)
  adsets: number; // ad-set-level budgets reset (or would be)
  errors: number;
}

export interface BudgetResetResult {
  dryRun: boolean;
  on: boolean;
  target: number; // THB
  campaignsReset: number; // campaign-level daily budgets set (or would be)
  adsetsReset: number; // ad-set-level daily budgets set (or would be)
  skipped: number; // campaigns nothing was done to (paused/archived, or lifetime-only)
  errors: string[];
  perAccount: AccountResetStat[];
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

interface MetaAdSet {
  id: string;
  name?: string;
  status?: string;
  daily_budget?: string;
}

/** One thing to reset — a campaign daily_budget or an ad-set daily_budget. */
type Target = { kind: "campaign" | "adset"; id: string; actId: string };

export async function resetCampaignBudgets(opts: { dryRun?: boolean } = {}): Promise<BudgetResetResult> {
  const dryRun = !!opts.dryRun;
  const rule = await ensureRule();
  const result: BudgetResetResult = {
    dryRun,
    on: rule.on,
    target: TARGET_THB,
    campaignsReset: 0,
    adsetsReset: 0,
    skipped: 0,
    errors: [],
    perAccount: [],
  };
  if (!rule.on) return result; // rule switched off — do nothing

  const token = await getActiveToken();
  const allow = (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // "Ran today" = campaigns with any spend in today's insight window (kept fresh by the
  // syncs). Union with active-now (below) targets every campaign opened or scaled during
  // the day — including ones now paused — while skipping the hundreds of dormant paused
  // campaigns that never ran. Meta campaign ids, to match the Graph campaign list.
  const ranRows = await prisma.campaign.findMany({
    where: { insights: { some: { window: "today", spend: { gt: 0 } } } },
    select: { metaCampaignId: true },
  });
  const ranToday = new Set(ranRows.map((r) => r.metaCampaignId));

  // Collect every reset target across all allowlisted accounts, with per-account tallies.
  const targets: Target[] = [];
  const statOf = new Map<string, AccountResetStat>();

  for (const a of await gatherAccounts(token)) {
    const actId = `act_${a.account_id}`;
    if (allow.length && !allow.includes(actId)) continue;
    const stat: AccountResetStat = { actId, name: a.name ?? actId, campaigns: 0, adsets: 0, errors: 0 };
    statOf.set(actId, stat);
    try {
      const camps = await graphGetAll<MetaCampaign>(
        `/${actId}/campaigns`,
        { fields: "id,name,status,daily_budget" },
        token,
      );
      for (const c of camps) {
        const status = (c.status ?? "").toUpperCase();
        // Only ACTIVE/PAUSED campaigns are editable; ARCHIVED/DELETED can't take a write.
        const editable = status === "ACTIVE" || status === "PAUSED";
        // Eligible = opened/scaled today: on right now, or ran today (even if now paused).
        const eligible = editable && (status === "ACTIVE" || ranToday.has(c.id));
        if (!eligible) {
          result.skipped++; // archived/deleted, or paused with no spend today — leave it alone
          continue;
        }
        if (c.daily_budget) {
          targets.push({ kind: "campaign", id: c.id, actId }); // campaign-level budget
          continue;
        }
        // Eligible campaign with NO campaign-level budget → its budget is at the ad-set level.
        // Reset each active/paused ad set that carries a daily budget (lifetime ad sets skip).
        try {
          const adsets = await graphGetAll<MetaAdSet>(
            `/${c.id}/adsets`,
            { fields: "id,name,status,daily_budget" },
            token,
          );
          const resettable = adsets.filter((s) => {
            const st = (s.status ?? "").toUpperCase();
            return (st === "ACTIVE" || st === "PAUSED") && s.daily_budget;
          });
          if (resettable.length === 0) {
            result.skipped++; // eligible campaign but nothing resettable (lifetime / archived ad sets)
            continue;
          }
          for (const s of resettable) targets.push({ kind: "adset", id: s.id, actId });
        } catch (e) {
          result.errors.push(`${c.id} adsets: ${e instanceof Error ? e.message : String(e)}`);
          stat.errors++;
        }
      }
    } catch (e) {
      result.errors.push(`${actId}: ${e instanceof Error ? e.message : String(e)}`);
      stat.errors++;
    }
  }

  const bump = (t: Target) => {
    const s = statOf.get(t.actId)!;
    if (t.kind === "campaign") {
      s.campaigns++;
      result.campaignsReset++;
    } else {
      s.adsets++;
      result.adsetsReset++;
    }
  };

  if (dryRun) {
    for (const t of targets) bump(t); // count only — no writes
    result.perAccount = [...statOf.values()];
    return result;
  }

  // Live writes — bounded concurrency to fit the 60s function limit. Each mutation sends
  // ONLY daily_budget (never status), so on/off state is untouched. Absolute-value writes
  // are idempotent, so the shared cursor + retries are safe.
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const t = targets[i++];
      try {
        if (t.kind === "campaign") {
          await setCampaignBudget(t.id, TARGET_MINOR, token);
          // Mirror the campaign-level budget in our DB (ad sets aren't mirrored).
          await prisma.campaign.updateMany({
            where: { metaCampaignId: t.id },
            data: { dailyBudgetMinor: TARGET_MINOR },
          });
        } else {
          await setAdSetBudget(t.id, TARGET_MINOR, t.actId, token);
        }
        bump(t);
      } catch (e) {
        result.errors.push(`${t.kind} ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
        statOf.get(t.actId)!.errors++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  result.perAccount = [...statOf.values()];

  // Bookkeeping: bump the rule. The run's activity-log entry is written by the cron route
  // (so failures that never reach here are still logged there).
  await prisma.rule.update({
    where: { id: BUDGET_RULE_ID },
    data: { runs: { increment: 1 }, lastRunAt: new Date() },
  });
  return result;
}
