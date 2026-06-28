import { NextResponse } from "next/server";
import { NOTIFICATIONS } from "@/data/notifications";

export function GET() {
  return NextResponse.json(NOTIFICATIONS);
}
