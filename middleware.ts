import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Edge runtime — NO Prisma, NO node:crypto here. This is a cheap cookie-presence
// fast-path only; the real validation is getCurrentUser() / withAuth() on the
// Node side. Never rely on this alone.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Only the login flow + cron are public. Note /api/auth/meta/* (connecting Meta
  // tokens) is deliberately NOT public — it's a privileged authed action.
  const isPublic =
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me" ||
    pathname.startsWith("/api/cron/");

  if (isPublic) return NextResponse.next();

  const hasCookie = req.cookies.has(SESSION_COOKIE);
  if (hasCookie) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
