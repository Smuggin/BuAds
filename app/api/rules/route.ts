import { NextResponse } from "next/server";
import { RULES } from "@/data/rules";

export function GET() {
  return NextResponse.json(RULES);
}
