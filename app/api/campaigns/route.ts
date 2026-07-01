import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow, windowDays, spanDays } from "@/lib/windows";
import type { AccountKey, Campaign } from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const window = rangeToWindow(params.get("range"));
  const days = windowDays(window, spanDays(params.get("since"), params.get("until")));
  // Campaigns that delivered in the selected window (mirrors Ads Manager) — i.e. have
  // an insight snapshot. Paused-but-delivered campaigns are included; never-delivered
  // ones stay in the DB but out of the view.
  const rows = await prisma.campaign.findMany({
    where: { insights: { some: { window } } },
    include: { adAccount: true, insights: { where: { window }, take: 1 } },
    orderBy: { syncedAt: "desc" },
  });
  const campaigns: Campaign[] = rows.map((c) => {
    const i = c.insights[0];
    return {
      id: c.metaCampaignId,
      name: c.name,
      sku: "", // filled below
      status: c.status, // real Meta on/off (mirrors Business Suite)
      account: c.adAccount.metaAccountId as AccountKey,
      budget: c.dailyBudgetMinor / 100,
      metrics: {
        roas: i?.roas ?? 0,
        ctr: i?.ctr ?? 0,
        cpa: i?.cpa ?? 0,
        cpm: i?.cpm ?? 0,
        cpp: i?.cpp ?? 0,
        cpr: i?.cpr ?? 0,
        cost: i ? Number(i.spend) / days : 0, // daily cost (Cost/วัน), window-aware
      },
    };
  });
  // attach sku (product) per campaign
  const prodIds = rows.map((c) => c.productId).filter((x): x is string => !!x);
  const prods = await prisma.product.findMany({ where: { id: { in: prodIds } } });
  const skuById = new Map(prods.map((p) => [p.id, p.sku]));
  rows.forEach((c, idx) => {
    campaigns[idx].sku = c.productId ? (skuById.get(c.productId) ?? "") : "";
  });
  // keep original k1..k12 order
  campaigns.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return NextResponse.json(campaigns);
}
