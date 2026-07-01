import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/**
 * Manually link / unlink a campaign to a product by SKU — the override for when
 * auto-match (Thai-name segment) gets it wrong or leaves a campaign unmapped.
 * `id` is the metaCampaignId (the DTO's Campaign.id). `sku: null | ""` unmaps.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { sku?: string | null } | null;
  if (!body || !("sku" in body)) {
    return NextResponse.json({ error: "sku required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { metaCampaignId: id } });
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sku = body.sku?.trim();
  let productId: string | null = null;
  if (sku) {
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) return NextResponse.json({ error: `SKU ${sku} not found` }, { status: 404 });
    productId = product.id;
  }

  await prisma.campaign.update({ where: { metaCampaignId: id }, data: { productId } });
  return NextResponse.json({ ok: true });
}
