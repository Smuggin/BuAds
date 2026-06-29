import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { OverviewAccountRow, SummaryCard } from "@/data/types";

const baht = (n: number) => "฿" + Math.round(n).toLocaleString("en-US");
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  const accounts = await prisma.adAccount.findMany({
    include: { campaigns: { include: { insights: { where: { window: "last_30d" } } } } },
    orderBy: { name: "asc" },
  });

  let tSpend = 0, tRev = 0, tPur = 0, tImpr = 0, tClicks = 0;
  const accountRows: OverviewAccountRow[] = accounts.map((a) => {
    let spend = 0, rev = 0, pur = 0, impr = 0, clicks = 0;
    for (const c of a.campaigns)
      for (const i of c.insights) {
        const s = Number(i.spend);
        spend += s; rev += s * i.roas; pur += i.purchases; impr += i.impressions; clicks += i.clicks;
      }
    tSpend += spend; tRev += rev; tPur += pur; tImpr += impr; tClicks += clicks;
    const roas = spend ? rev / spend : 0;
    const cpa = pur ? spend / pur : 0;
    const ctr = impr ? (clicks / impr) * 100 : 0;
    return {
      name: a.name, platform: a.platform, initials: a.initials,
      spend: baht(spend), revenue: baht(rev), roas: r2(roas) + "x",
      purchases: String(pur), cpa: baht(cpa), ctr: r2(ctr) + "%",
      status: a.status === "ACTIVE" ? "Active" : "Paused", rawSpend: Math.round(spend) || 0,
    };
  });

  const roasAll = tSpend ? tRev / tSpend : 0;
  const cpaAll = tPur ? tSpend / tPur : 0;
  const ctrAll = tImpr ? (tClicks / tImpr) * 100 : 0;
  const summary: SummaryCard[] = [
    { en: "Total Spend", th: "รายจ่ายรวม", value: baht(tSpend), delta: "", tone: "neutral", up: true },
    { en: "Revenue", th: "รายได้", value: baht(tRev), delta: "", tone: "pos", up: true },
    { en: "ROAS", th: "ผลตอบแทน", value: r2(roasAll) + "x", delta: "", tone: "pos", up: true },
    { en: "Purchases", th: "ยอดสั่งซื้อ", value: tPur.toLocaleString("en-US"), delta: "", tone: "pos", up: true },
    { en: "Avg CPA", th: "ต้นทุน/ออเดอร์", value: baht(cpaAll), delta: "", tone: "pos", up: false },
    { en: "CTR", th: "อัตราคลิก", value: r2(ctrAll) + "%", delta: "", tone: "pos", up: true },
  ];

  // daily series + audience breakdown require extra sync passes — empty until then.
  return NextResponse.json({
    summary,
    daily: [] as number[],
    accounts: accountRows,
    breakdown: { age: [], gender: [], province: [], heat: { days: [], grid: [] } },
  });
}
