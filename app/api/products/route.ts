import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AccountKey, Product } from "@/data/types";

// preserve the original demo order (drives ramp colors + product groups)
const ORDER = ["SRM-01", "SUN-50", "NGT-09", "TEE-22", "BAG-07", "GFT-03"];

export async function GET() {
  const rows = await prisma.product.findMany({
    include: { category: true, accounts: { include: { adAccount: true } } },
  });
  const products: Product[] = rows
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.sku);
      const ib = ORDER.indexOf(b.sku);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((p) => ({
      sku: p.sku,
      th: p.thName,
      en: p.enName,
      category: p.category.name,
      accounts: p.accounts.map((a) => a.adAccount.metaAccountId as AccountKey),
      unitCost: p.unitCost,
      img: p.imgUrl,
      autoClose: p.autoClose,
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
    }));
  return NextResponse.json(products);
}
