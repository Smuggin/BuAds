/**
 * getCurrentUser() — the real auth boundary (Node runtime). Reads the session
 * cookie, looks up the hashed token, enforces sliding + absolute expiry, and
 * slides the window. Returns null (never throws) so callers decide policy.
 *
 * NOT usable from Edge middleware (uses Prisma + node:crypto).
 */
import { prisma } from "@/lib/db";
import { hashToken, readSessionCookie } from "./session";
import { SESSION_TTL_MS, SESSION_ABS_MS } from "./constants";

export type CurrentUser = {
  id: string;
  username: string | null;
  email: string;
  name: string;
  initials: string;
  role: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const raw = await readSessionCookie();
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;

  const now = Date.now();
  const absoluteDead = now > session.createdAt.getTime() + SESSION_ABS_MS;
  const slidingDead = now > session.expiresAt.getTime();
  if (absoluteDead || slidingDead) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Slide the window, throttled to ~once/min to spare the DB on hot pages.
  if (now - session.lastUsedAt.getTime() > 60_000) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
      })
      .catch(() => {});
  }

  const u = session.user;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    initials: u.initials,
    role: u.role,
  };
}
