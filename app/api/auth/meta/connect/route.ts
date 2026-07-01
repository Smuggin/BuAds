import { NextResponse } from "next/server";
import { exchangeForLongLived, storeToken } from "@/lib/meta/auth";
import { requireAuth } from "@/lib/auth/guard";

/** Exchange the env short-lived token for a ~60-day long-lived one and store it. */
export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  const short = process.env.META_ACCESS_TOKEN;
  if (!short) return NextResponse.json({ error: "META_ACCESS_TOKEN not set" }, { status: 400 });
  try {
    const { token, expiresAt } = await exchangeForLongLived(short);
    await storeToken(token, {
      kind: "USER",
      expiresAt,
      scopes: ["ads_read", "ads_management", "business_management"],
    });
    return NextResponse.json({ ok: true, expiresAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
