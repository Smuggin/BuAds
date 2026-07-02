import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import { foldDailyByAccount, foldHourlyByAccount, type BreakdownAccum } from "@/lib/breakdown";
import { accountMetaFor } from "@/lib/constants";
import { fmtMetric, fmtMoney } from "@/lib/format";
import type { OverviewAccountRow, OverviewDailyAccount, SummaryCard } from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

// Money/ROAS/CTR go through the shared formatters (2 decimals, 1:1 with Business Suite);
// int is for whole counts (purchases, reach) that Business Suite shows without decimals.
const baht = (n: number) => fmtMoney(n);
const int = (n: number) => Math.round(n).toLocaleString("en-US");

export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const account = params.get("account") ?? "all";
  const window = rangeToWindow(params.get("range"));
  const accounts = await prisma.adAccount.findMany({
    where: account !== "all" ? { metaAccountId: account } : undefined,
    include: { campaigns: { include: { insights: { where: { window } } } } },
    orderBy: { name: "asc" },
  });

  let tSpend = 0, tRev = 0, tPur = 0, tImpr = 0, tClicks = 0, tReach = 0;
  let tDailyBudget = 0, campaignsWithSpend = 0;
  const accountRows: OverviewAccountRow[] = accounts.map((a) => {
    let spend = 0, rev = 0, pur = 0, impr = 0, clicks = 0;
    for (const c of a.campaigns) {
      let cSpend = 0;
      for (const i of c.insights) {
        const s = Number(i.spend);
        cSpend += s; rev += s * i.roas; pur += i.purchases; impr += i.impressions; clicks += i.clicks; tReach += i.reach;
      }
      spend += cSpend;
      if (cSpend > 0) campaignsWithSpend++;
      // Committed daily budget — only campaigns Meta reports ACTIVE (minor units → ฿).
      if (c.status === "ACTIVE") tDailyBudget += (c.dailyBudgetMinor ?? 0) / 100;
    }
    tSpend += spend; tRev += rev; tPur += pur; tImpr += impr; tClicks += clicks;
    const roas = spend ? rev / spend : 0;
    const cpa = pur ? spend / pur : 0;
    const ctr = impr ? (clicks / impr) * 100 : 0;
    return {
      name: a.name, platform: a.platform, initials: a.initials,
      spend: baht(spend), revenue: baht(rev), roas: fmtMetric("roas", roas),
      purchases: String(pur), cpa: baht(cpa), ctr: fmtMetric("ctr", ctr),
      status: a.status === "ACTIVE" ? "Active" : "Paused", rawSpend: Math.round(spend) || 0,
    };
  });

  const roasAll = tSpend ? tRev / tSpend : 0;
  const cpaAll = tPur ? tSpend / tPur : 0;
  const ctrAll = tImpr ? (tClicks / tImpr) * 100 : 0;
  const avgCampaignSpend = campaignsWithSpend ? tSpend / campaignsWithSpend : 0;
  const reachPer100 = tSpend ? (tReach / tSpend) * 100 : 0;
  // Full superset of cards; the client (KpiSummaryStrip) picks which to display.
  // `key` is the stable id used for selection/persistence — never change it.
  const summary: SummaryCard[] = [
    { key: "spend", en: "Total Spend", th: "รายจ่ายรวม", value: baht(tSpend), delta: "", tone: "neutral", up: true },
    { key: "revenue", en: "Revenue", th: "รายได้", value: baht(tRev), delta: "", tone: "pos", up: true },
    { key: "roas", en: "ROAS", th: "ผลตอบแทน", value: fmtMetric("roas", roasAll), delta: "", tone: "pos", up: true },
    { key: "purchases", en: "Purchases", th: "ยอดสั่งซื้อ", value: int(tPur), delta: "", tone: "pos", up: true },
    { key: "cpa", en: "Avg CPA", th: "ต้นทุน/ออเดอร์", value: baht(cpaAll), delta: "", tone: "pos", up: false },
    { key: "ctr", en: "CTR", th: "อัตราคลิก", value: fmtMetric("ctr", ctrAll), delta: "", tone: "pos", up: true },
    { key: "budget", en: "Daily Budget", th: "งบต่อวันรวม", value: baht(tDailyBudget), delta: "", tone: "neutral", up: true },
    { key: "avgSpend", en: "Avg / Campaign", th: "เฉลี่ย/แคมเปญ", value: baht(avgCampaignSpend), delta: "", tone: "neutral", up: true },
    { key: "reach100", en: "Reach / ฿100", th: "เข้าถึง/100฿", value: int(reachPer100), delta: "", tone: "pos", up: true },
  ];

  // Daily-spend series from the stored account breakdowns, kept per-account (for the
  // stacked chart) with both spend + revenue. Empty until a breakdown sync runs.
  const bdRows = await prisma.breakdownSnapshot.findMany({
    where: { window, ...(account !== "all" ? { adAccount: { metaAccountId: account } } : {}) },
    include: { adAccount: { select: { metaAccountId: true, name: true } } },
  });
  // "today" is a single day — show hourly bars (00:00..23:00) instead of one daily bar.
  const hourly = window === "today";
  const foldRows = bdRows.map((r) => ({
    metaAccountId: r.adAccount.metaAccountId,
    name: r.adAccount.name,
    accum: r.data as unknown as BreakdownAccum,
  }));
  const { dates, accounts: series } = hourly
    ? (({ labels, accounts }) => ({ dates: labels, accounts }))(foldHourlyByAccount(foldRows))
    : foldDailyByAccount(foldRows);
  const dailyByAccount: OverviewDailyAccount[] = series.map((s) => {
    const meta = accountMetaFor(s.metaAccountId, s.name);
    return { name: meta.th, initials: meta.initials, color: meta.color, spend: s.spend, revenue: s.revenue };
  });
  // folded total spend (legacy consumers / skeleton axis)
  const daily = dates.map((_, i) => dailyByAccount.reduce((sum, a) => sum + a.spend[i], 0));

  // audience breakdown still served by /api/breakdown; overview only needs the series.
  return NextResponse.json({
    summary,
    daily,
    dailyDates: dates,
    dailyGranularity: hourly ? "hour" : "day",
    dailyByAccount,
    accounts: accountRows,
    breakdown: { age: [], gender: [], province: [], heat: { days: [], grid: [] } },
  });
}
