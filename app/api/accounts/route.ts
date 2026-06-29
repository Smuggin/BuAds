import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Connected ad accounts (real, synced from Meta) for pickers/chips. */
export async function GET() {
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
