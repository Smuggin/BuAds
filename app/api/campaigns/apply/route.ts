import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, assertSameOrigin } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/current";
import { getActiveToken } from "@/lib/meta/auth";
import { setCampaignStatus, setCampaignBudget } from "@/lib/meta/mutations";

/**
 * Batch-commit staged campaign edits from the Campaigns page to Meta.
 * Each change may carry a status flip (on/off) and/or a new daily budget; both go
 * through the guarded mutations (assertWriteAllowed), then mirror to the DB and
 * write a MANUAL activity-log entry. Per-item results so the UI can clear only the
 * changes that actually landed and surface any that failed.
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

  const results: ItemResult[] = [];
  for (const ch of changes) {
    try {
      const camp = await prisma.campaign.findUnique({ where: { metaCampaignId: ch.id } });
      if (!camp) throw new Error("unknown campaign");

      // on/off flip
      if (ch.status === "ACTIVE" || ch.status === "PAUSED") {
        const before = camp.status;
        await setCampaignStatus(ch.id, ch.status, token); // guarded Meta write
        await prisma.campaign.update({ where: { metaCampaignId: ch.id }, data: { status: ch.status } });
        await prisma.activityLog.create({
          data: {
            actor: "MANUAL",
            userId: user?.id ?? null,
            campaignId: ch.id, // metaCampaignId — matches the History modal filter
            type: ch.status === "ACTIVE" ? "RESUME" : "PAUSE",
            title: ch.status === "ACTIVE" ? "เปิดแคมเปญ · Resume" : "ปิดแคมเปญ · Pause",
            detail: camp.name,
            beforeVal: before,
            afterVal: ch.status,
          },
        });
      }

      // daily budget
      if (typeof ch.dailyThb === "number" && ch.dailyThb > 0) {
        const beforeMinor = camp.dailyBudgetMinor;
        const minor = Math.round(ch.dailyThb * 100);
        await setCampaignBudget(ch.id, minor, token); // guarded Meta write (budget-only)
        await prisma.campaign.update({ where: { metaCampaignId: ch.id }, data: { dailyBudgetMinor: minor } });
        await prisma.activityLog.create({
          data: {
            actor: "MANUAL",
            userId: user?.id ?? null,
            campaignId: ch.id,
            type: minor >= beforeMinor ? "BUDGET_UP" : "BUDGET_DOWN",
            title: "ปรับงบ/วัน · Set daily budget",
            detail: `${camp.name} — ฿${beforeMinor / 100} → ฿${minor / 100}`,
            beforeVal: String(beforeMinor / 100),
            afterVal: String(minor / 100),
          },
        });
      }

      results.push({ id: ch.id, ok: true });
    } catch (e) {
      results.push({ id: ch.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ results });
}
