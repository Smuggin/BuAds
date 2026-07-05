import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LogActor, LogEntry, LogType } from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

const TYPE: Record<string, LogType> = {
  BUDGET_UP: "budget_up", BUDGET_DOWN: "budget_down", PAUSE: "pause",
  RESUME: "resume", AUTO_CLOSE: "auto_close", SCALE: "scale", KPI_EDIT: "kpi_edit",
};

// The team is in Thailand — render every log time/day in Bangkok wall-clock, NOT the
// server's timezone (Vercel runs in UTC, so `toTimeString()`/`toDateString()` showed the
// midnight reset as "5pm" etc.). Thailand is a fixed UTC+7 with no DST, so a flat offset is
// correct year-round (same convention as startOfBangkokDay() in lib/notify.ts).
const BKK_OFFSET_MS = 7 * 3_600_000;
/** "YYYY-MM-DD" of the instant in Bangkok. */
const bkkYmd = (d: Date): string => new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
/** "HH:MM" of the instant in Bangkok. */
const bkkHm = (d: Date): string => new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(11, 16);

function dayBucket(d: Date): string {
  const day = bkkYmd(d);
  const now = new Date();
  if (day === bkkYmd(now)) return "today";
  if (day === bkkYmd(new Date(now.getTime() - 86_400_000))) return "yesterday";
  return day;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const rows = await prisma.activityLog.findMany({ orderBy: { occurredAt: "desc" }, take: 100 });
  const logs: LogEntry[] = rows.map((r) => ({
    id: r.id,
    day: dayBucket(r.occurredAt),
    time: bkkHm(r.occurredAt),
    campaignId: r.campaignId ?? undefined,
    sku: r.productId ?? undefined,
    actor: (r.actor === "AUTO" ? "auto" : "manual") as LogActor,
    type: TYPE[r.type] ?? "kpi_edit",
    title: r.title,
    detail: r.detail,
  }));
  return NextResponse.json(logs);
}
