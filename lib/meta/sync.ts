/**
 * Read-only sync: pull real Meta accounts → campaigns → ads/creatives → insights
 * into the Prisma cache. Idempotent (upsert by meta*Id; snapshot replace per
 * entity+window). Never overwrites a user-set Campaign.productId. Server-only.
 */
import { prisma } from "@/lib/db";
import { accountMetaFor } from "@/lib/constants";
import { graphGet, graphGetAll } from "./client";
import { getActiveToken } from "./auth";
import { insightMetrics, toAdStatus, toFormat, type MetaInsightRow } from "./map";
import { matchCampaignToProduct } from "./productMatch";

const INSIGHT_FIELDS =
  "spend,impressions,clicks,ctr,cpm,reach,frequency,purchase_roas,actions,cost_per_action_type";

interface MetaAccount { account_id: string; name: string; currency?: string; account_status?: number }
interface MetaCampaign { id: string; name: string; status?: string; effective_status?: string; objective?: string; daily_budget?: string }
interface MetaAd { id: string; name?: string; campaign_id?: string; creative?: { id?: string; name?: string; object_type?: string; thumbnail_url?: string } }

export interface SyncResult {
  accounts: number;
  campaigns: number;
  creatives: number;
  insights: number;
  startedAt: string;
}

async function replaceInsight(
  level: "CAMPAIGN" | "CREATIVE" | "ACCOUNT",
  window: string,
  target: { campaignId?: string; creativeId?: string; adAccountId?: string },
  m: ReturnType<typeof insightMetrics>,
) {
  await prisma.insightSnapshot.deleteMany({ where: { level, window, ...target } });
  await prisma.insightSnapshot.create({
    data: { level, window, ...target, ...m, fetchedAt: new Date() },
  });
}

export async function runSync(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const token = await getActiveToken();
  const counts: SyncResult = { accounts: 0, campaigns: 0, creatives: 0, insights: 0, startedAt };

  const allow = (process.env.META_AD_ACCOUNTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const accounts = await graphGetAll<MetaAccount>(
    "/me/adaccounts",
    { fields: "account_id,name,currency,account_status" },
    token,
  );

  for (const a of accounts) {
    const actId = `act_${a.account_id}`;
    if (allow.length && !allow.includes(actId)) continue;
    const meta = accountMetaFor(actId, a.name);
    const status = a.account_status === 1 ? "ACTIVE" : "WARNING";
    const account = await prisma.adAccount.upsert({
      where: { metaAccountId: actId },
      update: { name: a.name, currency: a.currency ?? "THB", connected: true, status, lastSyncAt: new Date() },
      create: {
        metaAccountId: actId, name: a.name, platform: "Meta · FB + IG",
        initials: meta.initials, color: meta.color, currency: a.currency ?? "THB",
        connected: true, status, lastSyncAt: new Date(),
      },
    });
    counts.accounts++;

    const products = await prisma.product.findMany({
      select: { id: true, sku: true, thName: true, enName: true },
    });

    // campaigns
    const camps = await graphGetAll<MetaCampaign>(
      `/${actId}/campaigns`,
      { fields: "id,name,status,effective_status,objective,daily_budget" },
      token,
    );
    for (const c of camps) {
      const existing = await prisma.campaign.findUnique({ where: { metaCampaignId: c.id } });
      const productId = existing?.productId ?? matchCampaignToProduct(c.name, products);
      const data = {
        name: c.name, status: toAdStatus(c.status), effectiveStatus: c.effective_status,
        objective: c.objective, dailyBudgetMinor: c.daily_budget ? parseInt(c.daily_budget) : 0,
        statusSource: "META" as const, adAccountId: account.id, productId, syncedAt: new Date(),
      };
      await prisma.campaign.upsert({ where: { metaCampaignId: c.id }, update: data, create: { metaCampaignId: c.id, ...data } });
      counts.campaigns++;
    }

    // campaign insights (last_30d)
    const cIns = await graphGet<{ data: (MetaInsightRow & { campaign_id?: string })[] }>(
      `/${actId}/insights`,
      { level: "campaign", date_preset: "last_30d", fields: `campaign_id,${INSIGHT_FIELDS}`, limit: 500 },
      token,
    );
    for (const row of cIns.data ?? []) {
      const camp = await prisma.campaign.findUnique({ where: { metaCampaignId: row.campaign_id ?? "" } });
      if (!camp) continue;
      await replaceInsight("CAMPAIGN", "last_30d", { campaignId: camp.id }, insightMetrics(row));
      counts.insights++;
    }

    // ads → creatives (creative keyed by ad id, 1:1 with our Creative concept)
    const ads = await graphGetAll<MetaAd>(
      `/${actId}/ads`,
      { fields: "id,name,status,campaign_id,creative{id,name,object_type,thumbnail_url}" },
      token,
    );
    for (const ad of ads) {
      const cr = await prisma.creative.upsert({
        where: { metaCreativeId: ad.id },
        update: { name: ad.name || ad.creative?.name || "Ad", format: toFormat(ad.creative?.object_type), thumbnailUrl: ad.creative?.thumbnail_url, syncedAt: new Date() },
        create: { metaCreativeId: ad.id, name: ad.name || ad.creative?.name || "Ad", format: toFormat(ad.creative?.object_type), thumbnailUrl: ad.creative?.thumbnail_url, syncedAt: new Date() },
      });
      counts.creatives++;
      if (ad.campaign_id) {
        const camp = await prisma.campaign.findUnique({ where: { metaCampaignId: ad.campaign_id } });
        if (camp) {
          await prisma.campaignCreative.upsert({
            where: { campaignId_creativeId: { campaignId: camp.id, creativeId: cr.id } },
            update: {}, create: { campaignId: camp.id, creativeId: cr.id },
          });
        }
      }
    }

    // ad insights → creative snapshots
    const aIns = await graphGet<{ data: (MetaInsightRow & { ad_id?: string })[] }>(
      `/${actId}/insights`,
      { level: "ad", date_preset: "last_30d", fields: `ad_id,${INSIGHT_FIELDS}`, limit: 500 },
      token,
    );
    for (const row of aIns.data ?? []) {
      const cr = await prisma.creative.findUnique({ where: { metaCreativeId: row.ad_id ?? "" } });
      if (!cr) continue;
      await replaceInsight("CREATIVE", "last_30d", { creativeId: cr.id }, insightMetrics(row));
      counts.insights++;
    }
  }

  return counts;
}
