import { NextResponse } from "next/server";
import { DEFAULT_CATEGORIES } from "@/data/categories";

export function GET() {
  return NextResponse.json(DEFAULT_CATEGORIES);
}
