import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, assertSameOrigin } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/current";
import { getActiveToken } from "@/lib/meta/auth";
import { applyCampaignOps, type CampaignOp } from "@/lib/meta/mutations";

/**
 * Batch-commit staged campaign edits from the Campaigns page to Meta.
 * Each change may carry a status flip (on/off) and/or a new daily budget. All
 * changes go through the bulk write guard once, then to Meta in ONE Graph batch
 * call (applyCampaignOps), then the parts that actually landed are mirrored to
 * the DB in one transaction (grouped updateMany + one activityLog.createMany).
 * Per-item results so the UI can clear only the changes that landed and surface
 * any that failed. If a partial failure leaves Meta ahead of our mirror, the
 * 120s status poll / next sync reconciles.
 */
interface Change {
  id: string; // metaCampaignId
  status?: "ACTIVE" | "PAUSED";
  dailyThb?: number;
}
interface ItemResult {
  id: string;
  ok: boolean;
  error?: string;
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const badOrigin = assertSameOrigin(req);
  if (badOrigin) return badOrigin;

  const body = (await req.json().catch(() => null)) as { changes?: Change[] } | null;
  const changes = body?.changes;
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: "no changes" }, { status: 400 });
  }

  const user = await getCurrentUser();
  let token: string;
  try {
    token = await getActiveToken();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  const ops: CampaignOp[] = changes.map((ch) => ({
    metaCampaignId: ch.id,
    ...(ch.status === "ACTIVE" || ch.status === "PAUSED" ? { status: ch.status } : {}),
    ...(typeof ch.dailyThb === "number" && ch.dailyThb > 0
      ? { dailyBudgetMinor: Math.round(ch.dailyThb * 100) } // ฿300 → 30000
      : {}),
  }));

  const opResults = await applyCampaignOps(ops, token);

  // Mirror exactly the parts that landed on Meta, all in one transaction:
  // grouped status updateMany, one updateMany per distinct budget value, and a
  // single activityLog.createMany. (No statusSource change — matches the old
  // sequential behavior.)
  const toActive: string[] = [];
  const toPaused: string[] = [];
  const byBudget = new Map<number, string[]>();
  const logRows: Prisma.ActivityLogCreateManyInput[] = [];
  const results: ItemResult[] = [];

  for (const r of opResults) {
    results.push({ id: r.metaCampaignId, ok: r.ok, ...(r.error ? { error: r.error } : {}) });
    const before = r.before;
    if (!before) continue; // blocked by the guard — nothing reached Meta

    if (r.statusApplied) {
      (r.statusApplied === "ACTIVE" ? toActive : toPaused).push(r.metaCampaignId);
      logRows.push({
        actor: "MANUAL",
        userId: user?.id ?? null,
        campaignId: r.metaCampaignId, // metaCampaignId — matches the History modal filter
        type: r.statusApplied === "ACTIVE" ? "RESUME" : "PAUSE",
        title: r.statusApplied === "ACTIVE" ? "เปิดแคมเปญ · Resume" : "ปิดแคมเปญ · Pause",
        detail: before.name,
        beforeVal: before.status,
        afterVal: r.statusApplied,
      });
    }
    if (r.budgetApplied) {
      const minor = r.budgetApplied;
      byBudget.set(minor, [...(byBudget.get(minor) ?? []), r.metaCampaignId]);
      logRows.push({
        actor: "MANUAL",
        userId: user?.id ?? null,
        campaignId: r.metaCampaignId,
        type: minor >= before.dailyBudgetMinor ? "BUDGET_UP" : "BUDGET_DOWN",
        title: "ปรับงบ/วัน · Set daily budget",
        detail: `${before.name} — ฿${before.dailyBudgetMinor / 100} → ฿${minor / 100}`,
        beforeVal: String(before.dailyBudgetMinor / 100),
        afterVal: String(minor / 100),
      });
    }
  }

  const tx: Prisma.PrismaPromise<unknown>[] = [];
  if (toActive.length) {
    tx.push(
      prisma.campaign.updateMany({
        where: { metaCampaignId: { in: toActive } },
        data: { status: "ACTIVE" },
      }),
    );
  }
  if (toPaused.length) {
    tx.push(
      prisma.campaign.updateMany({
        where: { metaCampaignId: { in: toPaused } },
        data: { status: "PAUSED" },
      }),
    );
  }
  for (const [minor, ids] of byBudget) {
    tx.push(
      prisma.campaign.updateMany({
        where: { metaCampaignId: { in: ids } },
        data: { dailyBudgetMinor: minor },
      }),
    );
  }
  if (logRows.length) tx.push(prisma.activityLog.createMany({ data: logRows }));
  if (tx.length) await prisma.$transaction(tx);

  return NextResponse.json({ results });
}
