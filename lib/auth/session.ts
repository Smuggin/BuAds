/**
 * Opaque session tokens. The raw token is handed to the browser once (in an
 * httpOnly cookie); only its SHA-256 hash is stored in the DB. Server-only.
 */
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_ABS_MS } from "./constants";

/** Mint a new 256-bit opaque token + its DB hash. */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Set the session cookie. maxAge tracks the absolute window. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_ABS_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
