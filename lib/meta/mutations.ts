/**
 * Meta write-backs (mutations). Server-only. Requires an `ads_management` token.
 * Pausing/resuming a campaign here reflects in Meta Business Suite.
 *
 * Every mutation is fail-closed: assertWriteAllowed() (writeGuard.ts) throws
 * unless the master switch is on AND the campaign belongs to an allowlisted
 * account. This is the single choke point for auto-close, budget-reset, and the
 * write-test endpoint alike.
 */
import { graphBatch, graphPost, type BatchRequest } from "./client";
import { assertWriteAllowed, assertWritesAllowedBulk } from "./writeGuard";

/** Pause or resume a campaign in Meta. status ACTIVE = resume, PAUSED = pause. */
export async function setCampaignStatus(
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED",
  token: string,
): Promise<void> {
  await assertWriteAllowed(metaCampaignId);
  await graphPost<{ success?: boolean }>(`/${metaCampaignId}`, { status }, token);
}

/** Set a campaign's daily budget in Meta. dailyBudgetMinor = THB×100 (฿300 = 30000).
 *  Errors for campaigns whose budget is at the ad-set level or is a lifetime budget.
 *
 *  Budget-ONLY: the request body carries `daily_budget` and nothing else — no `status`
 *  is ever sent, so the campaign's on/off state in Meta is left exactly as-is (active
 *  stays active, paused stays paused). This is a hard invariant the nightly reset relies
 *  on; do not add other fields here. */
export async function setCampaignBudget(
  metaCampaignId: string,
  dailyBudgetMinor: number,
  token: string,
): Promise<void> {
  await assertWriteAllowed(metaCampaignId);
  // Frozen single-key body — guarantees we never co-send `status` (on/off) with a budget.
  const body = { daily_budget: dailyBudgetMinor } as const;
  await graphPost<{ success?: boolean }>(`/${metaCampaignId}`, body, token);
}

/** One staged campaign edit: a status flip and/or a new daily budget (minor units). */
export interface CampaignOp {
  metaCampaignId: string;
  status?: "ACTIVE" | "PAUSED";
  dailyBudgetMinor?: number;
}

export interface CampaignOpResult {
  metaCampaignId: string;
  /** Every requested part (status and/or budget) landed on Meta. */
  ok: boolean;
  error?: string; // first failing part's message (or the guard's block reason)
  statusApplied?: "ACTIVE" | "PAUSED"; // set when the status write landed
  budgetApplied?: number; // minor units, set when the budget write landed
  /** Before-values from the guard's prefetch — for DB mirroring + activity logs. */
  before?: { status: "ACTIVE" | "PAUSED"; dailyBudgetMinor: number; name: string };
}

/**
 * Apply a batch of staged campaign edits in ONE Graph HTTP call (the batch
 * endpoint; ≤50 sub-requests per call, each still counts toward quota).
 *
 * - Guarded in bulk: blocked ids get per-item errors and never reach Meta.
 * - A status flip and a budget change are SEPARATE sub-requests: the budget body
 *   is exactly `daily_budget=<minor>` — the budget-only invariant of
 *   setCampaignBudget survives batching because sub-request bodies are independent.
 * - Per-part results: a campaign whose status landed but whose budget failed
 *   reports ok=false with statusApplied set, so the caller mirrors exactly what
 *   changed on Meta and nothing more.
 */
export async function applyCampaignOps(
  ops: CampaignOp[],
  token: string,
): Promise<CampaignOpResult[]> {
  const guard = await assertWritesAllowedBulk(ops.map((o) => o.metaCampaignId));

  type Part = { opIndex: number; kind: "status" | "budget" };
  const reqs: BatchRequest[] = [];
  const parts: Part[] = [];
  ops.forEach((op, i) => {
    const g = guard.get(op.metaCampaignId);
    if (!g?.allowed) return;
    if (op.status === "ACTIVE" || op.status === "PAUSED") {
      reqs.push({ method: "POST", relative_url: op.metaCampaignId, body: `status=${op.status}` });
      parts.push({ opIndex: i, kind: "status" });
    }
    if (typeof op.dailyBudgetMinor === "number" && op.dailyBudgetMinor > 0) {
      // Frozen single-key body — never co-send `status` with a budget.
      reqs.push({
        method: "POST",
        relative_url: op.metaCampaignId,
        body: `daily_budget=${op.dailyBudgetMinor}`,
      });
      parts.push({ opIndex: i, kind: "budget" });
    }
  });

  const batch = reqs.length ? await graphBatch(reqs, token) : [];

  const statusOk = new Map<number, "ACTIVE" | "PAUSED">();
  const budgetOk = new Map<number, number>();
  const firstError = new Map<number, string>();
  batch.forEach((r, j) => {
    const { opIndex, kind } = parts[j];
    const op = ops[opIndex];
    if (r.ok) {
      if (kind === "status" && op.status) statusOk.set(opIndex, op.status);
      if (kind === "budget" && op.dailyBudgetMinor) budgetOk.set(opIndex, op.dailyBudgetMinor);
    } else if (!firstError.has(opIndex)) {
      firstError.set(opIndex, r.error ?? `HTTP ${r.status}`);
    }
  });

  return ops.map((op, i) => {
    const g = guard.get(op.metaCampaignId);
    if (!g?.allowed) {
      return { metaCampaignId: op.metaCampaignId, ok: false, error: g?.blocked ?? "blocked" };
    }
    const error = firstError.get(i);
    return {
      metaCampaignId: op.metaCampaignId,
      ok: !error,
      ...(error ? { error } : {}),
      ...(statusOk.has(i) ? { statusApplied: statusOk.get(i) } : {}),
      ...(budgetOk.has(i) ? { budgetApplied: budgetOk.get(i) } : {}),
      before: { status: g.status, dailyBudgetMinor: g.dailyBudgetMinor, name: g.name },
    };
  });
}
