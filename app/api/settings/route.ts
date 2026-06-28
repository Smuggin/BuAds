import { NextResponse } from "next/server";
import { CONNECTION_ACCOUNTS, AVAILABLE_ACCOUNTS } from "@/data/settings";

export function GET() {
  return NextResponse.json({ connected: CONNECTION_ACCOUNTS, available: AVAILABLE_ACCOUNTS });
}
