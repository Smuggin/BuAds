/**
 * Read-only creative/ad-level sync. For one account: pull every ad (+ its
 * creative), pull ad-level insights (incl. the video funnel), resolve each
 * creative's underlying post by its unique id, then upsert one row PER CREATIVE
 * (deduped across campaigns) with aggregated metrics. Mirrors the campaign pass
 * in sync.ts. Idempotent (upsert by metaCreativeId; snapshot replaced per window).
 * Coverage = every creative; metrics are delivery-driven (last 30d). Server-only.
 */
import { prisma } from "@/lib/db";
import { graphGet, graphGetAll, mapPool } from "./client";
import {
  aggregateInsights,
  buildAudienceProfile,
  emptyAudience,
  mergeAudience,
  toFormat,
  type AdAudience,
  type MetaInsightRow,
} from "./map";
import { fetchAudience } from "./audience";
import { matchCampaignToProduct, type ProductLite } from "./productMatch";
import { INSIGHT_WINDOWS } from "@/lib/windows";

const ADS_FIELDS =
  "id,name,effective_status,campaign_id," +
  "creative{id,name,object_type,thumbnail_url,image_url,video_id," +
  "effective_object_story_id,object_story_id,instagram_permalink_url}";

export const AD_INSIGHT_FIELDS =
  "ad_id,campaign_id,spend,impressions,clicks,ctr,cpm,reach,frequency," +
  "purchase_roas,actions,cost_per_action_type," +
  "video_play_actions,video_thruplay_watched_actions," +
  "video_p25_watched_actions,video_p50_watched_actions," +
  "video_p75_watched_actions,video_p100_watched_actions," +
  "video_avg_time_watched_actions";

// Bound the per-account post-resolution calls (many ads share one post).
const MAX_POSTS_PER_ACCOUNT = 200;

interface MetaCreativeObj {
  id: string;
  name?: string;
  object_type?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  effective_object_story_id?: string;
  object_story_id?: string;
  instagram_permalink_url?: string;
}
interface MetaAd {
  id: string;
  name?: string;
  effective_status?: string;
  campaign_id?: string;
  creative?: MetaCreativeObj;
}
interface MetaPost {
  permalink_url?: string;
  message?: string;
  full_picture?: string;
}

/** metaCampaignId → local Campaign row (built during the campaign pass). */
export type CampaignRef = { id: string; productId: string | null };

export interface CreativeSyncResult {
  creatives: number;
  links: number;
  insights: number;
  errors: string[];
}

export async function syncCreatives(
  account: { id: string; metaAccountId: string },
  token: string,
  campaignIdMap: Map<string, CampaignRef>,
  products: ProductLite[],
): Promise<CreativeSyncResult> {
  const result: CreativeSyncResult = { creatives: 0, links: 0, insights: 0, errors: [] };
  const actId = account.metaAccountId;

  // A/B/D. ads (+embedded creative), ad-level insights per window (incl. video funnel),
  // and per-ad audience breakdowns are independent fetches — run them concurrently.
  const [ads, insWindowEntries, audienceByAd] = await Promise.all([
    graphGetAll<MetaAd>(`/${actId}/ads`, { fields: ADS_FIELDS, limit: 500 }, token),
    Promise.all(
      INSIGHT_WINDOWS.map(async (window) => {
        const rows = await graphGetAll<MetaInsightRow>(
          `/${actId}/insights`,
          { level: "ad", date_preset: window, fields: AD_INSIGHT_FIELDS, limit: 500 },
          token,
        );
        const m = new Map<string, MetaInsightRow>();
        for (const r of rows) if (r.ad_id) m.set(r.ad_id, r);
        return [window, m] as const;
      }),
    ),
    fetchAudience(actId, token).catch((e) => {
      result.errors.push(`audience ${actId}: ${e instanceof Error ? e.message : String(e)}`);
      return new Map<string, AdAudience>();
    }),
  ]);
  const insByAdByWindow = new Map<string, Map<string, MetaInsightRow>>(insWindowEntries);

  // C. resolve distinct posts by unique id (best-effort, deduped, capped). Fetch with a
  //    bounded pool instead of one-at-a-time; kept per-id (not a batched ?ids= read) so
  //    a single unreachable post can't sink the rest of the batch.
  const storyIds = new Set<string>();
  for (const ad of ads) {
    const sid = ad.creative?.effective_object_story_id ?? ad.creative?.object_story_id;
    if (sid) storyIds.add(sid);
  }
  const posts = new Map<string, MetaPost>();
  await mapPool([...storyIds].slice(0, MAX_POSTS_PER_ACCOUNT), 6, async (sid) => {
    try {
      posts.set(
        sid,
        await graphGet<MetaPost>(`/${sid}`, { fields: "permalink_url,message,full_picture" }, token),
      );
    } catch {
      /* post not reachable (permissions / deleted) — degrade gracefully */
    }
  });

  // Group ads by creative id (one page row per creative, deduped across campaigns).
  const groups = new Map<string, { creative: MetaCreativeObj; ads: MetaAd[] }>();
  for (const ad of ads) {
    const cr = ad.creative;
    if (!cr?.id) continue;
    const g = groups.get(cr.id) ?? { creative: cr, ads: [] };
    g.ads.push(ad);
    groups.set(cr.id, g);
  }

  // Prefetch existing creative rows in one query (was a findUnique per creative).
  const existingByCreativeId = new Map(
    (
      await prisma.creative.findMany({
        where: { metaCreativeId: { in: [...groups.keys()] } },
        select: { metaCreativeId: true, productId: true },
      })
    ).map((c) => [c.metaCreativeId, c]),
  );

  for (const [metaCreativeId, g] of groups) {
    try {
      const cr = g.creative;
      // Fold every ad's audience breakdown into one creative-level profile.
      const audAcc = emptyAudience();
      for (const ad of g.ads) {
        const adAud = audienceByAd.get(ad.id);
        if (adAud) mergeAudience(audAcc, adAud);
      }
      const audience = buildAudienceProfile(audAcc);
      const adStatus: "ACTIVE" | "PAUSED" = g.ads.some(
        (ad) => (ad.effective_status ?? "").toUpperCase() === "ACTIVE",
      )
        ? "ACTIVE"
        : "PAUSED";

      const storyId = cr.effective_object_story_id ?? cr.object_story_id ?? null;
      const post = storyId ? posts.get(storyId) : undefined;

      // Product: keep an existing assignment; else inherit from the group's
      // campaigns; else best-effort match on the creative name.
      const existing = existingByCreativeId.get(metaCreativeId);
      let productId = existing?.productId ?? null;
      if (!productId) {
        for (const ad of g.ads) {
          const ref = ad.campaign_id ? campaignIdMap.get(ad.campaign_id) : undefined;
          if (ref?.productId) {
            productId = ref.productId;
            break;
          }
        }
      }
      if (!productId) productId = matchCampaignToProduct(cr.name ?? "", products);

      const data = {
        name: cr.name ?? "Creative",
        format: toFormat(cr.object_type),
        thumbnailUrl: cr.thumbnail_url ?? null,
        previewImageUrl: post?.full_picture ?? cr.image_url ?? null,
        permalinkUrl: post?.permalink_url ?? cr.instagram_permalink_url ?? null,
        // Post message when we can resolve it (owned Pages); else the creative
        // name, which for organic posts carries the caption text. Most ads promote
        // Pages we don't manage, so post resolution is rarely available.
        caption: post?.message ?? cr.name ?? null,
        metaPostId: storyId,
        videoId: cr.video_id ?? null,
        adStatus,
        productId,
        syncedAt: new Date(),
      };
      const creative = await prisma.creative.upsert({
        where: { metaCreativeId },
        update: data,
        create: { metaCreativeId, profileKey: "A", ...data },
      });
      result.creatives++;

      // Link to SYNCED campaigns only (skips dangling links to non-synced ones).
      const localCampIds = new Set<string>();
      for (const ad of g.ads) {
        const ref = ad.campaign_id ? campaignIdMap.get(ad.campaign_id) : undefined;
        if (ref) localCampIds.add(ref.id);
      }
      if (localCampIds.size) {
        await prisma.campaignCreative.createMany({
          data: [...localCampIds].map((campaignId) => ({ campaignId, creativeId: creative.id })),
          skipDuplicates: true,
        });
        result.links += localCampIds.size;
      }

      // Replace the CREATIVE snapshots; only write windows the creative delivered in.
      // Audience (30d-derived) is reused across windows. Two queries instead of a
      // deleteMany + create per window.
      await prisma.insightSnapshot.deleteMany({
        where: { level: "CREATIVE", creativeId: creative.id, window: { in: [...INSIGHT_WINDOWS] } },
      });
      const snapRows = INSIGHT_WINDOWS.flatMap((window) => {
        const insByAd = insByAdByWindow.get(window)!;
        const rows = g.ads
          .map((ad) => insByAd.get(ad.id))
          .filter((r): r is MetaInsightRow => !!r);
        if (!rows.length) return [];
        const agg = aggregateInsights(rows);
        if (agg.impressions <= 0) return [];
        const { video, engagement, ...kpis } = agg;
        return [{
          level: "CREATIVE" as const,
          window,
          creativeId: creative.id,
          ...kpis,
          video,
          engagement,
          audience: audience ?? undefined,
          fetchedAt: new Date(),
        }];
      });
      if (snapRows.length) {
        await prisma.insightSnapshot.createMany({ data: snapRows });
        result.insights += snapRows.length;
      }
    } catch (e) {
      result.errors.push(`creative ${metaCreativeId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
