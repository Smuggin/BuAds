import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import { shapeBreakdown, type BreakdownAccum } from "@/lib/breakdown";

/** Account-wide audience breakdown for the Breakdown page. Filters:
 *  ?range=7d|30d|90d (default 30d), ?account=act_…|all (default all). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const window = rangeToWindow(url.searchParams.get("range"));
  const account = url.searchParams.get("account") ?? "all";

  const rows = await prisma.breakdownSnapshot.findMany({
    where: {
      window,
      ...(account !== "all" ? { adAccount: { metaAccountId: account } } : {}),
    },
  });
  const accums = rows.map((r) => r.data as unknown as BreakdownAccum);
  return NextResponse.json(shapeBreakdown(accums));
}
