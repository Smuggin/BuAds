import { NextResponse } from "next/server";
import { CREATIVES } from "@/data/creatives";

export function GET() {
  return NextResponse.json(CREATIVES);
}
