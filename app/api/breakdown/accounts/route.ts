import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import type { BreakdownAccum } from "@/lib/breakdown";

/** metaAccountIds that actually have audience breakdown data for the given range —
 *  used to disable no-report accounts in the top-bar filter on the Breakdown page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const window = rangeToWindow(url.searchParams.get("range"));

  const rows = await prisma.breakdownSnapshot.findMany({
    where: { window },
    include: { adAccount: { select: { metaAccountId: true } } },
  });
  const ids = rows
    .filter((r) => {
      const d = r.data as unknown as BreakdownAccum;
      return d.age?.some((s) => s.impr > 0) || Object.keys(d.region ?? {}).length > 0;
    })
    .map((r) => r.adAccount.metaAccountId);
  return NextResponse.json(ids);
}
