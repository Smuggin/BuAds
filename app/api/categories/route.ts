import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const cats = await prisma.category.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(cats.map((c) => c.name));
}
