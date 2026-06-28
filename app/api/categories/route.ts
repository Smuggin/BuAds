import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const cats = await prisma.category.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(cats.map((c) => c.name));
}
