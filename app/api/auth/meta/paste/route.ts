import { NextResponse } from "next/server";
import { storeToken } from "@/lib/meta/auth";
import { requireAuth } from "@/lib/auth/guard";

/** Dev path: store a pasted Graph-Explorer token (encrypted). Expires ~1h. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { token } = (await req.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  await storeToken(token, { kind: "USER", expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return NextResponse.json({ ok: true });
}
