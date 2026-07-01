/**
 * Re-assign unmapped campaigns + creatives to a matching product SKU. Pure DB
 * (no Meta calls) — run right after a product is added/edited so existing,
 * already-synced campaigns group to the new SKU immediately. Never touches rows
 * that already have a productId (preserves manual + prior matches). Server-only.
 */
import { prisma } from "@/lib/db";
import { matchCampaignToProduct } from "./productMatch";

export async function regroupUnmapped(): Promise<{ campaigns: number; creatives: number }> {
  const products = await prisma.product.findMany({ select: { id: true, sku: true, thName: true } });
  if (!products.length) return { campaigns: 0, creatives: 0 };

  let campaigns = 0;
  const camps = await prisma.campaign.findMany({
    where: { productId: null },
    select: { id: true, name: true },
  });
  for (const c of camps) {
    const pid = matchCampaignToProduct(c.name, products);
    if (pid) {
      await prisma.campaign.update({ where: { id: c.id }, data: { productId: pid } });
      campaigns++;
    }
  }

  let creatives = 0;
  const crs = await prisma.creative.findMany({
    where: { productId: null },
    select: { id: true, name: true, campaigns: { select: { campaign: { select: { productId: true } } } } },
  });
  for (const c of crs) {
    // inherit a linked campaign's product first (mirrors the creative sync), else match by name
    let pid = c.campaigns.map((x) => x.campaign.productId).find((x): x is string => !!x) ?? null;
    if (!pid) pid = matchCampaignToProduct(c.name, products);
    if (pid) {
      await prisma.creative.update({ where: { id: c.id }, data: { productId: pid } });
      creatives++;
    }
  }
  return { campaigns, creatives };
}
