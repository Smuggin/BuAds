import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken, readSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guard";

export async function POST(req: Request) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;

  const raw = await readSessionCookie();
  if (raw) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(raw) } })
      .catch(() => {});
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
