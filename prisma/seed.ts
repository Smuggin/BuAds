/**
 * Seed the DB from the existing mock (data/*), preserving the demo dataset.
 * Relative imports (tsx doesn't resolve the @/ alias).
 */
import { PrismaClient, type CreativeFormat } from "@prisma/client";
import { ACCOUNT_META } from "../lib/constants";
import { DEFAULT_CATEGORIES } from "../data/categories";
import { PRODUCTS } from "../data/products";
import { CAMPAIGNS } from "../data/campaigns";
import { CREATIVES } from "../data/creatives";
import { CREATIVE_PROFILES } from "../data/profiles";
import type { AccountKey } from "../data/types";

const prisma = new PrismaClient();
const now = new Date();

async function main() {
  // wipe (idempotent reseed)
  await prisma.campaignCreative.deleteMany();
  await prisma.insightSnapshot.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.productAccount.deleteMany();
  await prisma.product.deleteMany();
  await prisma.adAccount.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // demo user (ActivityLog actor)
  await prisma.user.create({
    data: { email: "team@adshub.local", name: "Performance Team", initials: "PJ" },
  });

  // categories (built-ins)
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.create({ data: { name, isBuiltIn: true } });
  }
  const catByName = new Map(
    (await prisma.category.findMany()).map((c) => [c.name.toLowerCase(), c.id]),
  );

  // ad accounts (the 4 relation keys)
  for (const key of Object.keys(ACCOUNT_META) as AccountKey[]) {
    const m = ACCOUNT_META[key];
    await prisma.adAccount.create({
      data: { metaAccountId: key, name: m.th, platform: m.en, initials: m.initials, color: m.color },
    });
  }
  const accByKey = new Map(
    (await prisma.adAccount.findMany()).map((a) => [a.metaAccountId, a.id]),
  );

  // products (+ thresholds + account links)
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        thName: p.th,
        enName: p.en,
        unitCost: p.unitCost,
        imgUrl: p.img,
        custom: false,
        autoClose: p.autoClose,
        categoryId: catByName.get(p.category.toLowerCase())!,
        thrRoas: p.thresholds.roas,
        thrCtr: p.thresholds.ctr,
        thrCpa: p.thresholds.cpa,
        thrCpm: p.thresholds.cpm,
        thrCpp: p.thresholds.cpp,
        thrCpr: p.thresholds.cpr,
        thrCost: p.thresholds.cost,
      },
    });
    for (const key of p.accounts) {
      await prisma.productAccount.create({
        data: { productId: product.id, adAccountId: accByKey.get(key)! },
      });
    }
  }
  const prodBySku = new Map(
    (await prisma.product.findMany()).map((p) => [p.sku, p.id]),
  );

  // campaigns (+ a CAMPAIGN-level insight snapshot carrying the 7 metrics)
  for (const c of CAMPAIGNS) {
    const camp = await prisma.campaign.create({
      data: {
        metaCampaignId: c.id,
        name: c.name,
        status: "ACTIVE",
        objective: "OUTCOME_SALES",
        dailyBudgetMinor: c.budget * 100, // ฿ → satang
        statusSource: "META",
        adAccountId: accByKey.get(c.account)!,
        productId: prodBySku.get(c.sku),
        syncedAt: now,
      },
    });
    await prisma.insightSnapshot.create({
      data: {
        level: "CAMPAIGN",
        window: "last_30d",
        campaignId: camp.id,
        spend: c.metrics.cost, // our metrics.cost = daily cost → spend
        impressions: 0,
        clicks: 0,
        ctr: c.metrics.ctr,
        cpm: c.metrics.cpm,
        reach: 0,
        frequency: 0,
        roas: c.metrics.roas,
        purchases: 0,
        cpa: c.metrics.cpa,
        cpp: c.metrics.cpp,
        cpr: c.metrics.cpr,
        fetchedAt: now,
      },
    });
  }
  const campByMeta = new Map(
    (await prisma.campaign.findMany()).map((c) => [c.metaCampaignId, c.id]),
  );

  // creatives (+ insight snapshot w/ audience profile + campaign links)
  for (const cr of CREATIVES) {
    const creative = await prisma.creative.create({
      data: {
        metaCreativeId: cr.id,
        name: cr.name,
        format: cr.format.toUpperCase() as CreativeFormat,
        profileKey: cr.profileKey,
        productId: prodBySku.get(cr.sku),
        syncedAt: now,
      },
    });
    await prisma.insightSnapshot.create({
      data: {
        level: "CREATIVE",
        window: "last_30d",
        creativeId: creative.id,
        spend: cr.spend,
        impressions: cr.impressions,
        clicks: 0,
        ctr: cr.ctr,
        cpm: 0,
        reach: 0,
        frequency: cr.frequency,
        roas: cr.roas,
        purchases: cr.purchases,
        cpa: cr.cpa,
        cpp: 0,
        cpr: 0,
        audience: CREATIVE_PROFILES[cr.profileKey] as object,
        fetchedAt: now,
      },
    });
    for (const cid of cr.campaigns) {
      const campId = campByMeta.get(cid);
      if (campId) {
        await prisma.campaignCreative.create({
          data: { campaignId: campId, creativeId: creative.id },
        });
      }
    }
  }

  const counts = {
    categories: await prisma.category.count(),
    accounts: await prisma.adAccount.count(),
    products: await prisma.product.count(),
    campaigns: await prisma.campaign.count(),
    creatives: await prisma.creative.count(),
    insights: await prisma.insightSnapshot.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
