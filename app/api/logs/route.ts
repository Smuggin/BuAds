import { NextResponse } from "next/server";
import { LOGS } from "@/data/logs";

export function GET() {
  return NextResponse.json(LOGS);
}
