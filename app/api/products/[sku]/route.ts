import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { MetricKey } from "@/data/types";

const THR_COLUMN: Record<MetricKey, string> = {
  roas: "thrRoas",
  ctr: "thrCtr",
  cpa: "thrCpa",
  cpm: "thrCpm",
  cpp: "thrCpp",
  cpr: "thrCpr",
  cost: "thrCost",
};

/** Persist a product threshold edit or auto-close change, + an ActivityLog row. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;
  const body = (await req.json()) as {
    thresholds?: Partial<Record<MetricKey, number>>;
    autoClose?: boolean;
  };

  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, number | boolean> = {};
  let detail = "";
  if (body.thresholds) {
    for (const [k, v] of Object.entries(body.thresholds)) {
      data[THR_COLUMN[k as MetricKey]] = v as number;
      detail = `${k.toUpperCase()} → ${v}`;
    }
  }
  if (typeof body.autoClose === "boolean") {
    data.autoClose = body.autoClose;
    detail = `ปิดอัตโนมัติ → ${body.autoClose ? "เปิด" : "ปิด"}`;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no changes" }, { status: 400 });
  }

  await prisma.product.update({ where: { sku }, data });

  const user = await prisma.user.findFirst();
  await prisma.activityLog.create({
    data: {
      actor: "MANUAL",
      userId: user?.id,
      type: "KPI_EDIT",
      productId: product.id,
      title: "แก้เกณฑ์ KPI สินค้า",
      detail: `${product.thName} · ${detail}`,
    },
  });

  return NextResponse.json({ ok: true });
}
