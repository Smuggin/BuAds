/** Best-effort campaign→product match by name (product th/en/sku appears in campaign name). */
export interface ProductLite {
  id: string;
  sku: string;
  thName: string;
  enName: string;
}

export function matchCampaignToProduct(
  campaignName: string,
  products: ProductLite[],
): string | null {
  const name = campaignName.toLowerCase();
  for (const p of products) {
    const needles = [p.enName, p.thName, p.sku].map((s) => s.toLowerCase()).filter(Boolean);
    if (needles.some((n) => n.length >= 3 && name.includes(n))) return p.id;
  }
  return null;
}
