/**
 * Route-handler guards. requireAuth() is a one-liner drop-in at the top of any
 * API handler: `const denied = await requireAuth(); if (denied) return denied;`.
 * It validates the session token (the real boundary — middleware only checks
 * cookie presence). assertSameOrigin() is a cheap CSRF check for state-changing
 * POSTs — combined with the sameSite=lax cookie it blocks cross-site requests
 * without a CSRF token table.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "./current";

/** True if the request's Origin host matches its own host (or no Origin sent). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-CORS / same-origin navigations may omit Origin
  try {
    const host = req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Returns a 403 Response if the request is cross-origin, else null. */
export function assertSameOrigin(req: Request): Response | null {
  return isSameOrigin(req)
    ? null
    : NextResponse.json({ error: "bad origin" }, { status: 403 });
}

/**
 * Returns a 401 Response if the request is unauthenticated, else null.
 * Drop in at the top of a route handler:
 *   const denied = await requireAuth();
 *   if (denied) return denied;
 */
export async function requireAuth(): Promise<Response | null> {
  const user = await getCurrentUser();
  return user ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
