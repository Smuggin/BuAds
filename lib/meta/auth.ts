/**
 * Meta token resolution + storage. Server-only.
 * Single-token model: the most recent MetaToken row is active; falls back to
 * META_ACCESS_TOKEN env for quick local testing.
 */
import { prisma } from "@/lib/db";
import { encryptToken, decryptToken } from "./crypto";

export async function getActiveToken(): Promise<string> {
  const row = await prisma.metaToken.findFirst({ orderBy: { createdAt: "desc" } });
  if (row) {
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new Error("Meta token expired — reconnect in Settings");
    }
    return decryptToken(Buffer.from(row.accessTokenEnc));
  }
  const env = process.env.META_ACCESS_TOKEN;
  if (env) return env;
  throw new Error("No Meta token — connect an account first");
}

export async function hasToken(): Promise<boolean> {
  if (await prisma.metaToken.findFirst()) return true;
  return !!process.env.META_ACCESS_TOKEN;
}

/** Store a token (replaces any existing). Attaches to the demo user for FK. */
export async function storeToken(
  token: string,
  opts: { kind?: "USER" | "SYSTEM"; expiresAt?: Date; scopes?: string[] } = {},
): Promise<void> {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user row to attach the token to");
  await prisma.metaToken.deleteMany();
  await prisma.metaToken.create({
    data: {
      kind: opts.kind ?? "USER",
      accessTokenEnc: new Uint8Array(encryptToken(token)),
      scopes: opts.scopes ?? [],
      expiresAt: opts.expiresAt,
      userId: user.id,
    },
  });
}

/** Exchange a short-lived token for a ~60-day long-lived one (needs App Secret). */
export async function exchangeForLongLived(
  shortToken: string,
): Promise<{ token: string; expiresAt?: Date }> {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  const version = process.env.META_API_VERSION || "v23.0";
  if (!id || !secret) throw new Error("META_APP_ID / META_APP_SECRET required for long-lived exchange");
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", id);
  url.searchParams.set("client_secret", secret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
  if (!res.ok || !json.access_token) throw new Error(json.error?.message ?? "token exchange failed");
  return {
    token: json.access_token,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : undefined,
  };
}
