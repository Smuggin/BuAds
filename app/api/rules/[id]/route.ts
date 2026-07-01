import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/** Toggle a rule on/off (persists Rule.on so the cron honors it). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { on?: boolean } | null;
  if (!body || typeof body.on !== "boolean") {
    return NextResponse.json({ error: "on (boolean) required" }, { status: 400 });
  }
  try {
    await prisma.rule.update({ where: { id }, data: { on: body.on } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, on: body.on });
}
