import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import { aggregateAudienceProfiles } from "@/lib/breakdown";
import type { AudienceProfile } from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

/** Aggregated audience profile for one product (its creatives, spend-weighted),
 *  optionally scoped to an account. ?sku=…&account=act_…|all&range=7d|30d|90d. */
export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku");
  const account = url.searchParams.get("account") ?? "all";
  const window = rangeToWindow(url.searchParams.get("range"));
  if (!sku) return NextResponse.json({ error: "sku required" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
  if (!product) return NextResponse.json(null);

  const accFilter =
    account !== "all"
      ? { campaigns: { some: { campaign: { adAccount: { metaAccountId: account } } } } }
      : {};
  const creatives = await prisma.creative.findMany({
    where: { productId: product.id, ...accFilter },
    select: { insights: { where: { window }, take: 1, select: { spend: true, audience: true } } },
  });

  const items = creatives
    .map((c) => c.insights[0])
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => ({ audience: i.audience as unknown as AudienceProfile | null, spend: Number(i.spend) }));

  return NextResponse.json(aggregateAudienceProfiles(items));
}
