import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Prisma client used by the guard.
const findUnique = vi.fn();
const findMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    campaign: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));

import {
  assertWriteAllowed,
  assertWritesAllowedBulk,
  MetaWriteBlockedError,
  writesEnabled,
  writeAllowlist,
} from "./writeGuard";

const SANDBOX = "act_999";
function campaignInAccount(actId: string) {
  return { id: "c1", name: "Test campaign", adAccount: { metaAccountId: actId } };
}

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  delete process.env.META_WRITES_ENABLED;
  delete process.env.META_AD_ACCOUNTS;
});

describe("writesEnabled", () => {
  it("defaults off; only 'on' (any case) enables", () => {
    expect(writesEnabled()).toBe(false);
    process.env.META_WRITES_ENABLED = "true";
    expect(writesEnabled()).toBe(false);
    process.env.META_WRITES_ENABLED = "ON";
    expect(writesEnabled()).toBe(true);
  });
});

describe("writeAllowlist", () => {
  it("parses, trims, and drops blanks", () => {
    process.env.META_AD_ACCOUNTS = " act_1 , ,act_2 ";
    expect(writeAllowlist()).toEqual(["act_1", "act_2"]);
  });
});

describe("assertWriteAllowed — fail-closed matrix", () => {
  it("blocks when the master switch is off", async () => {
    process.env.META_AD_ACCOUNTS = SANDBOX;
    await expect(assertWriteAllowed("123")).rejects.toBeInstanceOf(MetaWriteBlockedError);
    expect(findUnique).not.toHaveBeenCalled(); // short-circuits before DB
  });

  it("blocks when the allowlist is empty (empty ≠ all for writes)", async () => {
    process.env.META_WRITES_ENABLED = "on";
    await expect(assertWriteAllowed("123")).rejects.toThrow(/allowlist|META_AD_ACCOUNTS/i);
  });

  it("blocks an unknown campaign", async () => {
    process.env.META_WRITES_ENABLED = "on";
    process.env.META_AD_ACCOUNTS = SANDBOX;
    findUnique.mockResolvedValue(null);
    await expect(assertWriteAllowed("123")).rejects.toThrow(/unknown campaign/i);
  });

  it("blocks a campaign in a non-allowlisted account", async () => {
    process.env.META_WRITES_ENABLED = "on";
    process.env.META_AD_ACCOUNTS = SANDBOX;
    findUnique.mockResolvedValue(campaignInAccount("act_REAL"));
    await expect(assertWriteAllowed("123")).rejects.toThrow(/not in the write allowlist/i);
  });

  it("allows a campaign in an allowlisted (sandbox) account", async () => {
    process.env.META_WRITES_ENABLED = "on";
    process.env.META_AD_ACCOUNTS = `act_other,${SANDBOX}`;
    findUnique.mockResolvedValue(campaignInAccount(SANDBOX));
    await expect(assertWriteAllowed("123")).resolves.toEqual({ actId: SANDBOX, name: "Test campaign" });
  });
});

describe("assertWritesAllowedBulk — same fail-closed matrix, one query", () => {
  const row = (metaCampaignId: string, actId: string) => ({
    metaCampaignId,
    name: `camp ${metaCampaignId}`,
    status: "ACTIVE",
    dailyBudgetMinor: 30000,
    adAccount: { metaAccountId: actId },
  });

  it("blocks everything when the master switch is off — without touching the DB", async () => {
    process.env.META_AD_ACCOUNTS = SANDBOX;
    const out = await assertWritesAllowedBulk(["1", "2"]);
    expect([...out.values()].every((e) => !e.allowed)).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("blocks everything on an empty allowlist", async () => {
    process.env.META_WRITES_ENABLED = "on";
    const out = await assertWritesAllowedBulk(["1"]);
    const e = out.get("1");
    expect(e?.allowed).toBe(false);
    expect(e && !e.allowed ? e.blocked : "").toMatch(/allowlist|META_AD_ACCOUNTS/i);
  });

  it("resolves per-id: allowed (with before-values), unknown, and wrong-account in one call", async () => {
    process.env.META_WRITES_ENABLED = "on";
    process.env.META_AD_ACCOUNTS = SANDBOX;
    findMany.mockResolvedValue([row("ok1", SANDBOX), row("wrong", "act_REAL")]);
    const out = await assertWritesAllowedBulk(["ok1", "wrong", "ghost"]);
    expect(findMany).toHaveBeenCalledTimes(1);

    const ok = out.get("ok1");
    expect(ok?.allowed).toBe(true);
    if (ok?.allowed) {
      expect(ok).toMatchObject({
        actId: SANDBOX,
        name: "camp ok1",
        status: "ACTIVE",
        dailyBudgetMinor: 30000,
      });
    }
    const wrong = out.get("wrong");
    expect(wrong?.allowed).toBe(false);
    expect(wrong && !wrong.allowed ? wrong.blocked : "").toMatch(/not in the write allowlist/i);

    const ghost = out.get("ghost");
    expect(ghost?.allowed).toBe(false);
    expect(ghost && !ghost.allowed ? ghost.blocked : "").toMatch(/unknown campaign/i);
  });
});
