import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, assertSameOrigin } from "@/lib/auth/guard";

/** Persist a manual product display order (drag-to-reorder in Product KPI).
 *  Body: { skus: string[] } in the desired order → sortOrder = index. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const bad = assertSameOrigin(req);
  if (bad) return bad;

  const body = (await req.json().catch(() => null)) as { skus?: string[] } | null;
  const skus = body?.skus;
  if (!Array.isArray(skus) || skus.some((s) => typeof s !== "string")) {
    return NextResponse.json({ error: "skus (string[]) required" }, { status: 400 });
  }

  await prisma.$transaction(
    skus.map((sku, i) => prisma.product.update({ where: { sku }, data: { sortOrder: i } })),
  );
  return NextResponse.json({ ok: true, count: skus.length });
}
