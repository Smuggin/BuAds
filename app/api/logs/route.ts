import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LogActor, LogEntry, LogType } from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

const TYPE: Record<string, LogType> = {
  BUDGET_UP: "budget_up", BUDGET_DOWN: "budget_down", PAUSE: "pause",
  RESUME: "resume", AUTO_CLOSE: "auto_close", SCALE: "scale", KPI_EDIT: "kpi_edit",
};

function dayBucket(d: Date): string {
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "yesterday";
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const rows = await prisma.activityLog.findMany({ orderBy: { occurredAt: "desc" }, take: 100 });
  const logs: LogEntry[] = rows.map((r) => ({
    id: r.id,
    day: dayBucket(r.occurredAt),
    time: r.occurredAt.toTimeString().slice(0, 5),
    campaignId: r.campaignId ?? undefined,
    sku: r.productId ?? undefined,
    actor: (r.actor === "AUTO" ? "auto" : "manual") as LogActor,
    type: TYPE[r.type] ?? "kpi_edit",
    title: r.title,
    detail: r.detail,
  }));
  return NextResponse.json(logs);
}
