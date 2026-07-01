import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  newSessionToken,
  hashToken,
  setSessionCookie,
  readSessionCookie,
} from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guard";
import {
  SESSION_TTL_MS,
  MAX_FAILED_LOGINS,
  LOCKOUT_MS,
} from "@/lib/auth/constants";

// Identical message for unknown-username, wrong-password, and locked accounts —
// no user enumeration.
const GENERIC = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง · Invalid username or password";

export async function POST(req: Request) {
  const bad = assertSameOrigin(req);
  if (bad) return bad;

  const body = (await req.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  const username = body?.username?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Locked account — same generic response, but still run a verify below to keep
  // timing uniform.
  const locked = !!user?.lockedUntil && user.lockedUntil.getTime() > Date.now();

  // Always verify (against a dummy hash when the user/hash is missing) to equalize
  // timing whether or not the account exists.
  const ok = await verifyPassword(user?.passwordHash ?? null, password);

  if (!user || locked || !ok) {
    if (user && !locked) {
      const count = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: count,
          lockedUntil:
            count >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      });
    }
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  // Success — reset brute-force counters.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  // Rotate: drop any session tied to the pre-login cookie (fixation defense).
  const existing = await readSessionCookie();
  if (existing) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(existing) } })
      .catch(() => {});
  }

  const { token, tokenHash } = newSessionToken();
  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: req.headers.get("user-agent") ?? null,
      ip:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        null,
    },
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      initials: user.initials,
      role: user.role,
    },
  });
}
