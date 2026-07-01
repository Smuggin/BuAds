import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import { requireAuth } from "@/lib/auth/guard";

/** Products present in an ad account (= have campaigns there), with per-account
 *  campaign count + windowed spend/ROAS. ?account=act_…|all, ?range=7d|30d|90d. */
export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "all";
  const window = rangeToWindow(url.searchParams.get("range"));
  const accFilter = account !== "all" ? { adAccount: { metaAccountId: account } } : {};

  const camps = await prisma.campaign.findMany({
    where: { ...accFilter, productId: { not: null } },
    select: {
      productId: true,
      product: {
        select: { sku: true, thName: true, closeMode: true, category: { select: { name: true } } },
      },
      insights: { where: { window }, take: 1, select: { spend: true, roas: true } },
    },
  });

  interface Agg {
    sku: string;
    name: string;
    category: string;
    closeMode: string;
    campaigns: number;
    spend: number;
    revenue: number;
  }
  const map = new Map<string, Agg>();
  for (const c of camps) {
    if (!c.productId || !c.product) continue;
    const a =
      map.get(c.productId) ??
      {
        sku: c.product.sku,
        name: c.product.thName,
        category: c.product.category.name,
        closeMode: c.product.closeMode,
        campaigns: 0,
        spend: 0,
        revenue: 0,
      };
    a.campaigns++;
    const i = c.insights[0];
    if (i) {
      const s = Number(i.spend);
      a.spend += s;
      a.revenue += s * i.roas;
    }
    map.set(c.productId, a);
  }

  const rows = [...map.values()]
    .map((a) => ({
      sku: a.sku,
      name: a.name,
      category: a.category,
      closeMode: a.closeMode,
      campaigns: a.campaigns,
      spend: Math.round(a.spend),
      roas: a.spend ? Math.round((a.revenue / a.spend) * 100) / 100 : 0,
    }))
    .sort((x, y) => y.spend - x.spend);
  return NextResponse.json(rows);
}
