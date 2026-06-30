import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { regroupUnmapped } from "@/lib/meta/regroup";
import type { AccountKey, CloseMode, MetricKey } from "@/data/types";

const THR_COLUMN: Record<MetricKey, string> = {
  roas: "thrRoas",
  ctr: "thrCtr",
  cpa: "thrCpa",
  cpm: "thrCpm",
  cpp: "thrCpp",
  cpr: "thrCpr",
  cost: "thrCost",
};

type PatchBody = {
  thresholds?: Partial<Record<MetricKey, number>>;
  closeMode?: CloseMode;
  th?: string;
  category?: string;
  unitCost?: number;
  img?: string | null;
  accounts?: AccountKey[];
};

/** Persist a product edit — profile (name/category/cost/img/accounts) or KPI
 *  threshold / auto-close — to the DB, + an ActivityLog row. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const details: string[] = [];

  if (body.thresholds) {
    for (const [k, v] of Object.entries(body.thresholds)) {
      data[THR_COLUMN[k as MetricKey]] = v as number;
      details.push(`${k.toUpperCase()} → ${v}`);
    }
  }
  if (body.closeMode && ["OFF", "SUGGEST", "AUTO"].includes(body.closeMode)) {
    data.closeMode = body.closeMode;
    const L: Record<CloseMode, string> = { OFF: "ปิด", SUGGEST: "แนะนำ", AUTO: "อัตโนมัติ" };
    details.push(`โหมดปิด → ${L[body.closeMode]}`);
  }
  if (typeof body.th === "string" && body.th.trim()) {
    data.thName = body.th.trim();
    details.push(`ชื่อ → ${body.th.trim()}`);
  }
  if (typeof body.unitCost === "number") {
    data.unitCost = Math.round(body.unitCost) || 0;
    details.push(`ต้นทุน → ${data.unitCost}`);
  }
  if (body.img !== undefined) data.imgUrl = body.img;
  if (typeof body.category === "string" && body.category.trim()) {
    const catName = body.category.trim();
    let category = await prisma.category.findFirst({
      where: { name: { equals: catName, mode: "insensitive" } },
    });
    category ??= await prisma.category.create({ data: { name: catName } });
    data.categoryId = category.id;
    details.push(`หมวด → ${catName}`);
  }

  // accounts: replace the ProductAccount join rows when provided
  let accountsChanged = false;
  if (Array.isArray(body.accounts)) {
    const accounts = body.accounts.length
      ? await prisma.adAccount.findMany({ where: { metaAccountId: { in: body.accounts } } })
      : [];
    await prisma.productAccount.deleteMany({ where: { productId: product.id } });
    if (accounts.length) {
      await prisma.productAccount.createMany({
        data: accounts.map((a) => ({ productId: product.id, adAccountId: a.id })),
      });
    }
    accountsChanged = true;
    details.push("บัญชี");
  }

  const hasScalarChanges = Object.keys(data).length > 0;
  if (!hasScalarChanges && !accountsChanged) {
    return NextResponse.json({ error: "no changes" }, { status: 400 });
  }
  if (hasScalarChanges) {
    await prisma.product.update({ where: { sku }, data: data as Prisma.ProductUpdateInput });
  }

  const isProfileEdit =
    body.th !== undefined ||
    body.category !== undefined ||
    body.unitCost !== undefined ||
    body.img !== undefined ||
    accountsChanged;

  // a renamed SKU may now match different campaigns — regroup the unmapped ones
  if (typeof body.th === "string" && body.th.trim()) {
    await regroupUnmapped().catch(() => {});
  }

  const user = await prisma.user.findFirst();
  await prisma.activityLog.create({
    data: {
      actor: "MANUAL",
      userId: user?.id,
      type: "KPI_EDIT",
      productId: product.id,
      title: isProfileEdit ? "แก้ไขสินค้า" : "แก้เกณฑ์ KPI สินค้า",
      detail: `${data.thName ?? product.thName} · ${details.join(" · ")}`,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Delete a product (ProductAccount links cascade; campaigns/creatives unlink). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.product.delete({ where: { sku } });
  return NextResponse.json({ ok: true });
}
