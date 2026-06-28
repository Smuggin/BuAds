import { NextResponse } from "next/server";
import { CAMPAIGNS } from "@/data/campaigns";

export function GET() {
  return NextResponse.json(CAMPAIGNS);
}
