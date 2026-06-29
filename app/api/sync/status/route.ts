import { NextResponse } from "next/server";
import { syncCampaignStatuses } from "@/lib/meta/statusSync";

export const maxDuration = 60;

/** Lightweight on/off status mirror from Meta (no insights). Polled by the client
 *  on focus and, on serverless deploys, by cron. */
export async function POST() {
  try {
    const result = await syncCampaignStatuses();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron triggers via GET. Same lightweight status mirror. */
export async function GET() {
  return POST();
}
