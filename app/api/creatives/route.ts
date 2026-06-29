import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Creative, CreativeFormat, ProfileKey } from "@/data/types";

const FMT: Record<string, CreativeFormat> = {
  VIDEO: "Video",
  REELS: "Reels",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
};

export async function GET() {
  const rows = await prisma.creative.findMany({
    include: {
      product: true,
      insights: { where: { window: "last_30d" }, take: 1 },
      campaigns: { include: { campaign: true } },
    },
    orderBy: { metaCreativeId: "asc" },
  });
  const creatives: Creative[] = rows.map((cr) => {
    const i = cr.insights[0];
    return {
      id: cr.metaCreativeId,
      name: cr.name,
      format: FMT[cr.format] ?? "Image",
      sku: cr.product?.sku ?? "",
      campaigns: cr.campaigns.map((cc) => cc.campaign.metaCampaignId),
      profileKey: (cr.profileKey ?? "A") as ProfileKey,
      spend: i ? Number(i.spend) : 0,
      impressions: i?.impressions ?? 0,
      roas: i?.roas ?? 0,
      ctr: i?.ctr ?? 0,
      cpa: i?.cpa ?? 0,
      purchases: i?.purchases ?? 0,
      frequency: i?.frequency ?? 0,
    };
  });
  creatives.sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2)));
  return NextResponse.json(creatives);
}
