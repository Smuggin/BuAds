/**
 * Notification writers. Shared by the sync ("ควรปิด" alerts) and the daily report
 * cron. Deduped by (title, calendar-day-in-Bangkok) so a repeatedly-breaching
 * campaign only alerts once per day and re-running the report is idempotent.
 * Server-only.
 */
import { prisma } from "@/lib/db";

export type NotifyKind = "success" | "warn" | "info";

/** UTC instant of the most recent Bangkok (UTC+7) midnight — the day boundary. */
export function startOfBangkokDay(now = new Date()): Date {
  const bkk = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - 7 * 3_600_000);
}

/** Create a notification unless one with the same title already exists today.
 *  Returns true if a row was written, false if it was deduped. */
export async function notifyOnce(input: {
  kind: NotifyKind;
  title: string;
  detail: string;
}): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: { title: input.title, createdAt: { gte: startOfBangkokDay() } },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.notification.create({
    data: { kind: input.kind, title: input.title, detail: input.detail },
  });
  return true;
}
