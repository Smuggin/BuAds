import { NextResponse } from "next/server";
import { runSync } from "@/lib/meta/sync";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
