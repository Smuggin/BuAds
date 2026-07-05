import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rangeToWindow } from "@/lib/windows";
import { groupCreatives, type CreativeGroupInput } from "@/lib/creatives";
import type {
  AudienceProfile,
  Creative,
  CreativeEngagement,
  CreativeFormat,
  CreativeVideo,
  ProfileKey,
} from "@/data/types";
import { requireAuth } from "@/lib/auth/guard";

const FMT: Record<string, CreativeFormat> = {
  VIDEO: "Video",
  REELS: "Reels",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
};

/**
 * Creatives list — deduped by underlying post and pruned. The same Meta post reused
 * across ads/adsets/accounts spawns one Creative row per ad-creative; here we:
 *   1. gate to creatives with delivery in the last 30 days (drops ~94% dead rows),
 *   2. scope to the selected ad account (metrics = that account's slice; "all" = combined),
 *   3. group by post identity (metaPostId ?? videoId ?? metaCreativeId) and merge metrics.
 * Metrics follow the selected `range`; the hide-gate is always last_30d.
 */
export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const window = rangeToWindow(params.get("range"));
  const account = params.get("account") ?? "all";

  const rows = await prisma.creative.findMany({
    where: { insights: { some: { window: "last_30d", impressions: { gt: 0 } } } },
    include: {
      product: true,
      insights: { where: { window: { in: [window, "last_30d"] } } },
      campaigns: {
        include: { campaign: { include: { adAccount: { select: { metaAccountId: true } } } } },
      },
    },
    orderBy: { metaCreativeId: "asc" },
  });

  const inputs: CreativeGroupInput[] = [];
  for (const cr of rows) {
    const accounts = new Set(cr.campaigns.map((cc) => cc.campaign.adAccount.metaAccountId));
    if (account !== "all" && !accounts.has(account)) continue;

    const i = cr.insights.find((x) => x.window === window); // selected-window metrics
    // Audience is 30d-derived and reused across windows by the full sync, so short
    // windows (today/custom) that carry no audience of their own fall back to it.
    const audience30 = cr.insights.find((x) => x.window === "last_30d")?.audience;
    const spend = i ? Number(i.spend) : 0;
    const creative: Creative = {
      id: cr.metaCreativeId,
      name: cr.name,
      format: FMT[cr.format] ?? "Image",
      sku: cr.product?.sku ?? "",
      campaigns: cr.campaigns.map((cc) => cc.campaign.metaCampaignId),
      profileKey: (cr.profileKey ?? "A") as ProfileKey,
      spend,
      impressions: i?.impressions ?? 0,
      roas: i?.roas ?? 0,
      ctr: i?.ctr ?? 0,
      cpa: i?.cpa ?? 0,
      purchases: i?.purchases ?? 0,
      frequency: i?.frequency ?? 0,
      reach: i?.reach ?? 0,
      cpm: i?.cpm ?? 0,
      revenue: spend * (i?.roas ?? 0),
      thumbnailUrl: cr.thumbnailUrl ?? undefined,
      previewImageUrl: cr.previewImageUrl ?? undefined,
      permalinkUrl: cr.permalinkUrl ?? undefined,
      videoId: cr.videoId ?? undefined,
      caption: cr.caption ?? undefined,
      adStatus: cr.adStatus ?? undefined,
      video: (i?.video as CreativeVideo | null) ?? undefined,
      engagement: (i?.engagement as CreativeEngagement | null) ?? undefined,
      audience: ((i?.audience ?? audience30) as AudienceProfile | null) ?? undefined,
    };

    inputs.push({
      key: cr.metaPostId ?? cr.videoId ?? cr.metaCreativeId,
      creative,
      raw: {
        spend,
        impressions: i?.impressions ?? 0,
        clicks: i?.clicks ?? 0,
        purchases: i?.purchases ?? 0,
        reach: i?.reach ?? 0,
        revenue: spend * (i?.roas ?? 0),
      },
      campaignIds: cr.campaigns.map((cc) => cc.campaign.metaCampaignId),
      active: cr.adStatus === "ACTIVE",
    });
  }

  // One entry per post, metrics summed + rates recomputed, sorted by spend desc.
  return NextResponse.json(groupCreatives(inputs));
}
