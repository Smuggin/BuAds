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
