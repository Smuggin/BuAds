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
    select: {
      insights: {
        where: { window: { in: [window, "last_30d"] } },
        select: { window: true, spend: true, audience: true },
      },
    },
  });

  // Weight by the selected window's spend; audience is 30d-derived and reused across
  // windows, so today/custom (which carry no audience of their own) fall back to it.
  // Creatives with no selected-window snapshot fall back to last_30d entirely.
  const items = creatives
    .map((c) => {
      const sel = c.insights.find((x) => x.window === window);
      const d30 = c.insights.find((x) => x.window === "last_30d");
      const row = sel ?? d30;
      if (!row) return null;
      return {
        audience: (sel?.audience ?? d30?.audience) as unknown as AudienceProfile | null,
        spend: Number(row.spend),
      };
    })
    .filter((i): i is NonNullable<typeof i> => !!i);

  return NextResponse.json(aggregateAudienceProfiles(items));
}
