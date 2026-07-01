/**
 * Bootstrap products from the campaigns already in the DB: for each distinct
 * Thai product-name segment (the part the matcher keys on) that has no product
 * yet, create one (unitCost 0 — edited later, mode SUGGEST, default thresholds),
 * then regroup so campaigns/creatives link to it. Idempotent. Server-only.
 */
import { prisma } from "@/lib/db";
import { DEFAULT_THRESHOLDS } from "@/lib/constants";
import { extractProductSegment, matchCampaignToProduct, type ProductLite } from "@/lib/meta/productMatch";
import { regroupUnmapped } from "@/lib/meta/regroup";

const THAI = /[฀-๿]/;

export interface BootstrapResult {
  created: { sku: string; name: string }[];
  skippedNoisy: number; // campaigns whose name had no clean Thai product segment
  regrouped: { campaigns: number; creatives: number };
}

export async function createProductsFromCampaigns(): Promise<BootstrapResult> {
  const existing: ProductLite[] = await prisma.product.findMany({
    select: { id: true, sku: true, thName: true },
  });
  const campaigns = await prisma.campaign.findMany({ select: { name: true } });

  // distinct, clean Thai segments that no existing product already covers
  const fresh = new Map<string, string>(); // normalized key → display name
  let skippedNoisy = 0;
  for (const c of campaigns) {
    const seg = extractProductSegment(c.name);
    // need a real Thai product name; skip creative-code noise like "{O} H242 [V4]…"
    if (!THAI.test(seg) || seg.includes("{") || seg.includes("[")) {
      skippedNoisy++;
      continue;
    }
    const key = seg.toLowerCase().replace(/\s+/g, "");
    if (key.length < 2) continue;
    if (matchCampaignToProduct(c.name, existing)) continue; // already has a product
    const prev = fresh.get(key);
    if (!prev || seg.length > prev.length) fresh.set(key, seg); // keep the fullest display
  }

  // category fallback for the new products
  let category =
    (await prisma.category.findFirst({ where: { name: { equals: "Custom", mode: "insensitive" } } })) ??
    (await prisma.category.findFirst());
  category ??= await prisma.category.create({ data: { name: "Custom" } });

  const t = DEFAULT_THRESHOLDS;
  const created: { sku: string; name: string }[] = [];
  let n = 0;
  for (const name of fresh.values()) {
    let sku = "";
    do {
      sku = `AUTO-${(++n).toString().padStart(3, "0")}`;
    } while (await prisma.product.findUnique({ where: { sku } }));
    await prisma.product.create({
      data: {
        sku,
        thName: name,
        unitCost: 0,
        custom: true,
        closeMode: "SUGGEST",
        categoryId: category.id,
        thrRoas: t.roas, thrCtr: t.ctr, thrCpa: t.cpa, thrCpm: t.cpm, thrCpp: t.cpp, thrCpr: t.cpr, thrCost: t.cost,
      },
    });
    created.push({ sku, name });
  }

  const regrouped = await regroupUnmapped();
  return { created, skippedNoisy, regrouped };
}
