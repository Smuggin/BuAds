import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Notification, NotificationKind } from "@/data/types";

export async function GET() {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const items: Notification[] = rows.map((n) => ({
    id: n.id,
    kind: n.kind as NotificationKind,
    time: n.createdAt.toTimeString().slice(0, 5),
    title: n.title,
    detail: n.detail,
  }));
  return NextResponse.json(items);
}
