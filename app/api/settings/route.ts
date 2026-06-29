import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AvailableAccount, ConnectionAccount, ConnStatus } from "@/data/types";

function relTime(d: Date | null): string {
  if (!d) return "ยังไม่ซิงค์";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  return `${Math.floor(min / 60)} ชม.ที่แล้ว`;
}

const STATUS: Record<string, ConnStatus> = {
  ACTIVE: "active",
  SYNCING: "syncing",
  WARNING: "warning",
};

export async function GET() {
  const accounts = await prisma.adAccount.findMany({
    include: {
      _count: { select: { products: true } },
      campaigns: { select: { insights: { where: { window: "last_30d" }, select: { spend: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const connected: ConnectionAccount[] = accounts
    .filter((a) => a.connected)
    .map((a) => {
      const spend = a.campaigns.reduce(
        (s, c) => s + c.insights.reduce((t, i) => t + Number(i.spend), 0),
        0,
      );
      return {
        id: a.metaAccountId,
        name: a.name,
        platform: a.platform,
        initials: a.initials,
        color: a.color,
        connected: true,
        status: STATUS[a.status] ?? "active",
        lastSync: relTime(a.lastSyncAt),
        spend: "฿" + Math.round(spend).toLocaleString("en-US"),
        products: a._count.products,
      };
    });

  const available: AvailableAccount[] = accounts
    .filter((a) => !a.connected)
    .map((a) => ({
      id: a.metaAccountId,
      name: a.name,
      platform: a.platform,
      initials: a.initials,
      color: a.color,
    }));

  return NextResponse.json({ connected, available });
}
