import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import type {
  AudienceProfile,
  Creative,
  CreativeEngagement,
  CreativeFormat,
  CreativeVideo,
  ProfileKey,
} from "@/data/types";

const FMT: Record<string, CreativeFormat> = {
  VIDEO: "Video",
  REELS: "Reels",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
};

export async function GET(req: Request) {
  const window = rangeToWindow(new URL(req.url).searchParams.get("range"));
  const rows = await prisma.creative.findMany({
    include: {
      product: true,
      insights: { where: { window }, take: 1 },
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
      thumbnailUrl: cr.thumbnailUrl ?? undefined,
      previewImageUrl: cr.previewImageUrl ?? undefined,
      permalinkUrl: cr.permalinkUrl ?? undefined,
      videoId: cr.videoId ?? undefined,
      caption: cr.caption ?? undefined,
      adStatus: cr.adStatus ?? undefined,
      video: (i?.video as CreativeVideo | null) ?? undefined,
      engagement: (i?.engagement as CreativeEngagement | null) ?? undefined,
      audience: (i?.audience as AudienceProfile | null) ?? undefined,
    };
  });
  // Delivering creatives first (real spend), then by name. (Never coerce the
  // long-numeric metaCreativeId to a JS Number — that loses precision.)
  creatives.sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name, "th"));
  return NextResponse.json(creatives);
}
