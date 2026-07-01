/**
 * Deliberate, single-target Meta write trigger — for sandbox testing.
 *
 * Safety: auth + same-origin gated; dryRun defaults true; a LIVE write additionally
 * requires `confirm === campaignId`. The actual Graph write still passes through
 * the fail-closed writeGuard (master switch + account allowlist), so this endpoint
 * cannot touch a non-allowlisted account even if called with a live payload.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current";
import { assertSameOrigin } from "@/lib/auth/guard";
import { getActiveToken } from "@/lib/meta/auth";
import { graphGet } from "@/lib/meta/client";
import { setCampaignStatus, setCampaignBudget } from "@/lib/meta/mutations";
import { assertWriteAllowed, MetaWriteBlockedError, writesEnabled } from "@/lib/meta/writeGuard";

type Action = "pause" | "resume" | "budget";

type Body = {
  action?: Action;
  campaignId?: string; // Meta campaign id (metaCampaignId)
  dailyBudgetThb?: number;
  confirm?: string;
  dryRun?: boolean;
};

/** Does the active token actually have ads_management granted? null = unknown. */
async function hasAdsManagement(token: string): Promise<boolean | null> {
  try {
    const r = await graphGet<{ data?: { permission: string; status: string }[] }>(
      "/me/permissions",
      {},
      token,
    );
    return (
      r.data?.some((p) => p.permission === "ads_management" && p.status === "granted") ?? null
    );
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const bad = assertSameOrigin(req);
  if (bad) return bad;

  const body = (await req.json().catch(() => null)) as Body | null;
  const action = body?.action;
  const campaignId = body?.campaignId?.trim();
  const dryRun = body?.dryRun !== false; // default true
  if (!action || !["pause", "resume", "budget"].includes(action)) {
    return NextResponse.json({ error: "action must be pause | resume | budget" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }
  if (action === "budget" && !(typeof body?.dailyBudgetThb === "number" && body.dailyBudgetThb > 0)) {
    return NextResponse.json({ error: "dailyBudgetThb (> 0) required for budget" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { metaCampaignId: campaignId },
    include: { adAccount: true },
  });

  const target = {
    action,
    campaignId,
    campaignName: campaign?.name ?? null,
    account: campaign?.adAccount.metaAccountId ?? null,
    dailyBudgetThb: action === "budget" ? body?.dailyBudgetThb : undefined,
  };

  // ---- DRY RUN: report what would happen, no Graph write ----
  if (dryRun) {
    let wouldRun = true;
    let blockedReason: string | null = null;
    try {
      await assertWriteAllowed(campaignId);
    } catch (e) {
      wouldRun = false;
      blockedReason = e instanceof MetaWriteBlockedError ? e.message : String(e);
    }
    let tokenHasAdsManagement: boolean | null = null;
    try {
      tokenHasAdsManagement = await hasAdsManagement(await getActiveToken());
    } catch {
      tokenHasAdsManagement = null;
    }
    return NextResponse.json({
      dryRun: true,
      wouldRun,
      blockedReason,
      writesEnabled: writesEnabled(),
      tokenHasAdsManagement,
      target,
    });
  }

  // ---- LIVE: require explicit confirmation ----
  if (body?.confirm !== campaignId) {
    return NextResponse.json(
      { error: "confirm must equal campaignId for a live write" },
      { status: 400 },
    );
  }

  try {
    const token = await getActiveToken();
    if (action === "budget") {
      const minor = Math.round((body!.dailyBudgetThb as number) * 100);
      const before = campaign?.dailyBudgetMinor ?? null;
      await setCampaignBudget(campaignId, minor, token); // guarded
      await prisma.campaign.update({
        where: { metaCampaignId: campaignId },
        data: { dailyBudgetMinor: minor },
      });
      await prisma.activityLog.create({
        data: {
          actor: "MANUAL",
          userId: user.id,
          type: before !== null && minor < before ? "BUDGET_DOWN" : "BUDGET_UP",
          campaignId: campaign?.id,
          title: "ตั้งงบ/วัน (ทดสอบ) · Set daily budget (test)",
          detail: `${target.campaignName ?? campaignId} → ฿${body!.dailyBudgetThb}`,
          beforeVal: before !== null ? `฿${before / 100}` : null,
          afterVal: `฿${body!.dailyBudgetThb}`,
        },
      });
      return NextResponse.json({ ok: true, action, campaignId, dailyBudgetMinor: minor });
    }

    // pause | resume
    const status = action === "pause" ? "PAUSED" : "ACTIVE";
    await setCampaignStatus(campaignId, status, token); // guarded
    await prisma.campaign.update({
      where: { metaCampaignId: campaignId },
      data: { status, statusSource: "MANUAL" },
    });
    await prisma.activityLog.create({
      data: {
        actor: "MANUAL",
        userId: user.id,
        type: action === "pause" ? "PAUSE" : "RESUME",
        campaignId: campaign?.id,
        title:
          action === "pause"
            ? "หยุดแคมเปญ (ทดสอบ) · Pause campaign (test)"
            : "เปิดแคมเปญ (ทดสอบ) · Resume campaign (test)",
        detail: target.campaignName ?? campaignId,
      },
    });
    return NextResponse.json({ ok: true, action, campaignId, status });
  } catch (e) {
    const blocked = e instanceof MetaWriteBlockedError;
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, blocked }, { status: blocked ? 403 : 502 });
  }
}
