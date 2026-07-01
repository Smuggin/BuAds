import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MARKED_ROAS_MULTIPLIER } from "@/lib/constants";
import { evalCampaign } from "@/lib/kpi";
import { INSIGHT_WINDOW_DAYS } from "@/lib/meta/map";
import { notifyOnce } from "@/lib/notify";
import type { MetricKey } from "@/data/types";

export const maxDuration = 60;

// Public route (see middleware `/api/cron/` allow-list) — gated by CRON_SECRET when
// configured (Vercel/GitHub Actions send it). Same pattern as /api/cron/daily.
function denyUnlessCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // not configured (local dev) — allow
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`
    ? null
    : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Rank the day's creatives (3-metric verdict: roas/ctr/cpa) against each one's
 *  product thresholds and return the winners (marked/ok), ROAS-desc. */
async function goodCreativesToday(window: string) {
  const rows = await prisma.creative.findMany({
    where: { product: { isNot: null }, insights: { some: { window } } },
    include: { product: true, insights: { where: { window }, take: 1 } },
  });
  const winners = rows
    .map((cr) => {
      const i = cr.insights[0];
      const p = cr.product!;
      if (!i || Number(i.spend) <= 0) return null;
      const pass = i.roas >= p.thrRoas && i.ctr >= p.thrCtr && i.cpa <= p.thrCpa;
      if (!pass) return null;
      const marked = i.roas >= p.thrRoas * MARKED_ROAS_MULTIPLIER;
      return { name: cr.name, roas: i.roas, spend: Number(i.spend), marked };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .sort((a, b) => b.roas - a.roas);
  return winners;
}

/** Count still-active campaigns breaching their product KPIs (advisory close). */
async function shouldCloseCount(window: string) {
  const camps = await prisma.campaign.findMany({
    where: { status: "ACTIVE", product: { isNot: null } },
    include: { product: true, insights: { where: { window }, take: 1 } },
  });
  let n = 0;
  for (const c of camps) {
    const i = c.insights[0];
    const p = c.product!;
    if (!i || p.closeMode === "OFF") continue;
    const verdict = evalCampaign(
      { roas: i.roas, ctr: i.ctr, cpa: i.cpa, cpm: i.cpm, cpp: i.cpp, cpr: i.cpr, cost: Number(i.spend) / INSIGHT_WINDOW_DAYS },
      { roas: p.thrRoas, ctr: p.thrCtr, cpa: p.thrCpa, cpm: p.thrCpm, cpp: p.thrCpp, cpr: p.thrCpr, cost: p.thrCost },
      p.skipMetrics as MetricKey[],
    ).verdict;
    if (verdict === "breach") n++;
  }
  return n;
}

/** Daily 22:00 report (fired by a GitHub Actions cron). Writes a notification
 *  summarizing the day's best creatives, plus the current "ควรปิด" backlog. */
async function runReport() {
  // Prefer today's freshly-synced numbers; fall back to the 7-day window if today
  // hasn't been synced (the report cron doesn't itself sync).
  let window = "today";
  let winners = await goodCreativesToday(window);
  if (!winners.length) {
    const fallback = await goodCreativesToday("last_7d");
    if (fallback.length) {
      window = "last_7d";
      winners = fallback;
    }
  }

  const top = winners.slice(0, 5);
  const scope = window === "today" ? "วันนี้" : "7 วันล่าสุด";
  if (winners.length) {
    const list = top.map((w) => `${w.name} (${w.roas.toFixed(2)}x)`).join(" · ");
    await notifyOnce({
      kind: "success",
      title: "ครีเอทีฟทำผลงานดีวันนี้",
      detail: `${scope}: ${winners.length} ครีเอทีฟผ่านเกณฑ์ — ${list}`,
    });
  } else {
    await notifyOnce({
      kind: "info",
      title: "ครีเอทีฟทำผลงานดีวันนี้",
      detail: `${scope}: ยังไม่มีครีเอทีฟที่ผ่านเกณฑ์`,
    });
  }

  const closeN = await shouldCloseCount("last_30d");
  if (closeN > 0) {
    await notifyOnce({
      kind: "warn",
      title: "สรุปแคมเปญที่ควรปิด",
      detail: `มี ${closeN} แคมเปญยังเปิดอยู่แต่เกินเกณฑ์ KPI — แนะนำให้ตรวจสอบและปิด`,
    });
  }

  return { window, winners: winners.length, shouldClose: closeN };
}

export async function POST(req: Request) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await runReport());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GitHub Actions curls GET; keep POST for parity with /api/cron/daily.
export async function GET(req: Request) {
  return POST(req);
}
