import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deriveScaleThreshold, DEFAULT_THRESHOLDS } from "@/lib/constants";
import { regroupUnmapped } from "@/lib/meta/regroup";
import type { AccountKey, CloseMode, MetricKey, Product, Thresholds } from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

// preserve the original demo order (drives ramp colors + product groups)
const ORDER = ["SRM-01", "SUN-50", "NGT-09", "TEE-22", "BAG-07", "GFT-03"];

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const rows = await prisma.product.findMany({
    include: {
      category: true,
      accounts: { include: { adAccount: true } },
      image: true,
    },
  });
  const products: Product[] = rows
    .sort((a, b) => {
      // manual drag order wins; the curated ORDER list is the tiebreak while
      // sortOrder is still all-zero (before anyone has reordered).
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const ia = ORDER.indexOf(a.sku);
      const ib = ORDER.indexOf(b.sku);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((p) => ({
      sku: p.sku,
      th: p.thName,
      category: p.category.name,
      accounts: p.accounts.map((a) => a.adAccount.metaAccountId as AccountKey),
      unitCost: p.unitCost,
      img: p.image?.url ?? p.imgUrl,
      closeMode: p.closeMode,
      skipMetrics: (p.skipMetrics ?? []) as MetricKey[],
      custom: p.custom,
      thresholds: {
        roas: p.thrRoas,
        ctr: p.thrCtr,
        cpa: p.thrCpa,
        cpm: p.thrCpm,
        cpp: p.thrCpp,
        cpr: p.thrCpr,
        cost: p.thrCost,
      },
      // Scale targets fall back to a derived value while a metric has no explicit one.
      scaleThresholds: {
        roas: p.scaleRoas ?? deriveScaleThreshold("roas", p.thrRoas),
        ctr: p.scaleCtr ?? deriveScaleThreshold("ctr", p.thrCtr),
        cpm: p.scaleCpm ?? deriveScaleThreshold("cpm", p.thrCpm),
        cpp: p.scaleCpp ?? deriveScaleThreshold("cpp", p.thrCpp),
      },
    }));
  return NextResponse.json(products);
}

type CreateBody = {
  sku?: string;
  th: string;
  category: string;
  accounts?: AccountKey[];
  unitCost: number;
  img?: string | null;
  closeMode?: CloseMode;
  skipMetrics?: MetricKey[];
  thresholds?: Partial<Thresholds>;
  scaleThresholds?: Partial<Record<MetricKey, number>>;
};

/** Create a new product (+ category if needed, thresholds, account links). */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body || !body.th?.trim()) {
    return NextResponse.json({ error: "name (th) required" }, { status: 400 });
  }

  const sku = (body.sku?.trim() || `NEW-${Date.now().toString(36).toUpperCase()}`).toUpperCase();
  if (await prisma.product.findUnique({ where: { sku } })) {
    return NextResponse.json({ error: `SKU ${sku} already exists` }, { status: 409 });
  }

  // resolve category by name; create a custom one if it doesn't exist yet
  const catName = body.category?.trim() || "Custom";
  let category = await prisma.category.findFirst({
    where: { name: { equals: catName, mode: "insensitive" } },
  });
  category ??= await prisma.category.create({ data: { name: catName } });

  const thr: Thresholds = { ...DEFAULT_THRESHOLDS, ...body.thresholds };
  const scale = body.scaleThresholds ?? {};
  const accountKeys = body.accounts ?? [];
  const accounts = accountKeys.length
    ? await prisma.adAccount.findMany({ where: { metaAccountId: { in: accountKeys } } })
    : [];

  await prisma.product.create({
    data: {
      sku,
      thName: body.th.trim(),
      unitCost: Math.round(body.unitCost) || 0,
      imgUrl: body.img ?? null,
      custom: true,
      closeMode: body.closeMode ?? "SUGGEST",
      skipMetrics: body.skipMetrics ?? [],
      categoryId: category.id,
      thrRoas: thr.roas,
      thrCtr: thr.ctr,
      thrCpa: thr.cpa,
      thrCpm: thr.cpm,
      thrCpp: thr.cpp,
      thrCpr: thr.cpr,
      thrCost: thr.cost,
      scaleRoas: scale.roas ?? deriveScaleThreshold("roas", thr.roas),
      scaleCtr: scale.ctr ?? deriveScaleThreshold("ctr", thr.ctr),
      scaleCpm: scale.cpm ?? deriveScaleThreshold("cpm", thr.cpm),
      scaleCpp: scale.cpp ?? deriveScaleThreshold("cpp", thr.cpp),
      accounts: { create: accounts.map((a) => ({ adAccountId: a.id })) },
    },
  });

  // group already-synced unmapped campaigns/creatives to the new SKU right away
  const grouped = await regroupUnmapped().catch(() => ({ campaigns: 0, creatives: 0 }));

  return NextResponse.json({ ok: true, sku, grouped }, { status: 201 });
}
