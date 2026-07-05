/**
 * Fail-closed guard for ALL Meta write-backs. Server-only.
 *
 * A write is refused unless every one of these holds:
 *   1. META_WRITES_ENABLED=on           — global master switch (default off)
 *   2. the campaign's ad account is in META_AD_ACCOUNTS  — the write allowlist
 *      (NOTE: for writes an EMPTY allowlist means NONE — the opposite of reads,
 *       where empty means "all accounts". This is deliberate: writes fail closed.)
 *   3. the campaign resolves in our DB to that allowlisted account
 *
 * Every mutation in lib/meta/mutations.ts calls assertWriteAllowed() first, so
 * auto-close, budget-reset, and the write-test endpoint all inherit these gates.
 * Env is read at call-time (not module load) so it reflects the current process.
 */
import { prisma } from "@/lib/db";

export class MetaWriteBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaWriteBlockedError";
  }
}

/** Master switch. Default off — nothing writes to Meta unless explicitly enabled. */
export function writesEnabled(): boolean {
  return (process.env.META_WRITES_ENABLED ?? "off").toLowerCase() === "on";
}

/** act_<id> accounts writes may target. Empty = none (fail-closed). */
export function writeAllowlist(): string[] {
  return (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Account-scoped variant of the fail-closed gate. Ad sets aren't mirrored in our
 * DB, so ad-set budget writes (nightly reset) can't resolve through a campaign row —
 * the caller passes the owning `act_` id it already resolved from the account loop,
 * and this enforces the SAME master-switch + allowlist checks. Throws on refusal.
 */
export function assertAccountWriteAllowed(actId: string): void {
  if (!writesEnabled()) {
    throw new MetaWriteBlockedError("Meta writes are disabled (set META_WRITES_ENABLED=on)");
  }
  const allow = writeAllowlist();
  if (allow.length === 0) {
    throw new MetaWriteBlockedError(
      "No write-allowlisted accounts — set META_AD_ACCOUNTS to the target act_ id(s)",
    );
  }
  if (!allow.includes(actId)) {
    throw new MetaWriteBlockedError(`Account ${actId} is not in the write allowlist (META_AD_ACCOUNTS)`);
  }
}

/**
 * Throw MetaWriteBlockedError unless a write to this campaign is permitted.
 * Returns the resolved account id + campaign name on success.
 */
export async function assertWriteAllowed(
  metaCampaignId: string,
): Promise<{ actId: string; name: string }> {
  if (!writesEnabled()) {
    throw new MetaWriteBlockedError("Meta writes are disabled (set META_WRITES_ENABLED=on)");
  }

  const allow = writeAllowlist();
  if (allow.length === 0) {
    throw new MetaWriteBlockedError(
      "No write-allowlisted accounts — set META_AD_ACCOUNTS to the target act_ id(s)",
    );
  }

  const campaign = await prisma.campaign.findUnique({
    where: { metaCampaignId },
    include: { adAccount: true },
  });
  if (!campaign) {
    throw new MetaWriteBlockedError(`Unknown campaign ${metaCampaignId} — refusing write`);
  }

  const actId = campaign.adAccount.metaAccountId;
  if (!allow.includes(actId)) {
    throw new MetaWriteBlockedError(
      `Account ${actId} is not in the write allowlist (META_AD_ACCOUNTS)`,
    );
  }

  return { actId, name: campaign.name };
}

/** Per-id verdict from the bulk guard: allowed (with the before-values the apply
 *  route needs for mirroring + activity logs) or blocked with the reason. */
export type BulkWriteEntry =
  | {
      allowed: true;
      actId: string;
      name: string;
      status: "ACTIVE" | "PAUSED";
      dailyBudgetMinor: number;
    }
  | { allowed: false; blocked: string };

/**
 * Bulk variant of assertWriteAllowed for the apply route: the same fail-closed
 * checks, but the env gates run once and ALL campaigns resolve in one findMany
 * (instead of a findUnique per change). Never throws — blocked ids carry their
 * reason so the caller can return per-item errors without touching Meta.
 */
export async function assertWritesAllowedBulk(
  metaCampaignIds: string[],
): Promise<Map<string, BulkWriteEntry>> {
  const out = new Map<string, BulkWriteEntry>();
  const blockAll = (msg: string): Map<string, BulkWriteEntry> => {
    for (const id of metaCampaignIds) out.set(id, { allowed: false, blocked: msg });
    return out;
  };

  if (!writesEnabled()) {
    return blockAll("Meta writes are disabled (set META_WRITES_ENABLED=on)");
  }
  const allow = writeAllowlist();
  if (allow.length === 0) {
    return blockAll("No write-allowlisted accounts — set META_AD_ACCOUNTS to the target act_ id(s)");
  }

  const rows = await prisma.campaign.findMany({
    where: { metaCampaignId: { in: metaCampaignIds } },
    include: { adAccount: true },
  });
  const byId = new Map(rows.map((c) => [c.metaCampaignId, c]));
  for (const id of metaCampaignIds) {
    const c = byId.get(id);
    if (!c) {
      out.set(id, { allowed: false, blocked: `Unknown campaign ${id} — refusing write` });
      continue;
    }
    const actId = c.adAccount.metaAccountId;
    if (!allow.includes(actId)) {
      out.set(id, {
        allowed: false,
        blocked: `Account ${actId} is not in the write allowlist (META_AD_ACCOUNTS)`,
      });
      continue;
    }
    out.set(id, {
      allowed: true,
      actId,
      name: c.name,
      status: c.status,
      dailyBudgetMinor: c.dailyBudgetMinor,
    });
  }
  return out;
}
