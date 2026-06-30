/**
 * Best-effort campaign→product match keyed on the Thai product-name field.
 *
 * Real campaign names are pipe-delimited and the Thai segment is the product
 * (สินค้า) name, e.g.:
 *   "09/06 | K14 | 1-3 | ถุงมือขนสัตว์ | No inter | 300"
 *                        └── product name
 * We extract that segment and match it against each product's Thai name.
 * Pure + framework-agnostic (unit-tested).
 */
export interface ProductLite {
  id: string;
  sku: string;
  thName: string;
}

const THAI = /[฀-๿]/;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * Pull the product-name text from a campaign name: the pipe-delimited segment
 * that contains Thai characters (the longest one, if several). Falls back to the
 * whole name when there are no pipes or no Thai segment.
 */
export function extractProductSegment(campaignName: string): string {
  // Meta tags duplicated campaigns with "สำเนา" (copy). Drop it first so a
  // "… | 300 - สำเนา" budget/copy segment doesn't win as the longest Thai
  // segment over the real product name.
  const cleaned = campaignName.replace(/สำเนา/g, " ");
  const parts = cleaned
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const thai = parts.filter((p) => THAI.test(p));
  if (thai.length) return thai.sort((a, b) => b.length - a.length)[0];
  return cleaned.trim();
}

/**
 * Match a campaign to a product id by its Thai-name segment. Prefers the most
 * specific product: an exact name beats "segment contains name" beats "name
 * contains segment", ties broken by the longest Thai name. Falls back to an exact
 * SKU token in the raw name. Returns null when nothing matches (unmapped).
 */
export function matchCampaignToProduct(
  campaignName: string,
  products: ProductLite[],
): string | null {
  const seg = norm(extractProductSegment(campaignName));
  if (seg) {
    let best: { id: string; score: number; len: number } | null = null;
    for (const p of products) {
      const th = norm(p.thName);
      if (th.length < 2) continue;
      const score = seg === th ? 3 : seg.includes(th) ? 2 : th.includes(seg) ? 1 : 0;
      if (score === 0) continue;
      if (!best || score > best.score || (score === best.score && th.length > best.len)) {
        best = { id: p.id, score, len: th.length };
      }
    }
    if (best) return best.id;
  }
  // secondary: an exact SKU token present in the raw name
  const upper = campaignName.toUpperCase();
  for (const p of products) {
    if (p.sku.length >= 3 && upper.includes(p.sku.toUpperCase())) return p.id;
  }
  return null;
}
