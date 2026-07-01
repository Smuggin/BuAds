import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/** Connected ad accounts (real, synced from Meta) for pickers/chips. */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const rows = await prisma.adAccount.findMany({
    where: { connected: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    rows.map((a) => ({
      id: a.metaAccountId,
      name: a.name,
      initials: a.initials,
      color: a.color,
    })),
  );
}
