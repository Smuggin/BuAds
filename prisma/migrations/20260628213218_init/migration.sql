-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConnStatus" AS ENUM ('ACTIVE', 'SYNCING', 'WARNING');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ChangeActor" AS ENUM ('MANUAL', 'AUTO', 'META');

-- CreateEnum
CREATE TYPE "CreativeFormat" AS ENUM ('VIDEO', 'REELS', 'CAROUSEL', 'IMAGE');

-- CreateEnum
CREATE TYPE "InsightLevel" AS ENUM ('ACCOUNT', 'CAMPAIGN', 'ADSET', 'AD', 'CREATIVE');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('BUDGET_UP', 'BUDGET_DOWN', 'PAUSE', 'RESUME', 'AUTO_CLOSE', 'SCALE', 'KPI_EDIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaToken" (
    "id" TEXT NOT NULL,
    "kind" "TokenKind" NOT NULL,
    "accessTokenEnc" BYTEA NOT NULL,
    "scopes" TEXT[],
    "businessId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "metaAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "status" "ConnStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "thName" TEXT NOT NULL,
    "enName" TEXT NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "imgUrl" TEXT,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "autoClose" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT NOT NULL,
    "thrRoas" DOUBLE PRECISION NOT NULL,
    "thrCtr" DOUBLE PRECISION NOT NULL,
    "thrCpa" INTEGER NOT NULL,
    "thrCpm" INTEGER NOT NULL,
    "thrCpp" INTEGER NOT NULL,
    "thrCpr" INTEGER NOT NULL,
    "thrCost" INTEGER NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAccount" (
    "productId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,

    CONSTRAINT "ProductAccount_pkey" PRIMARY KEY ("productId","adAccountId")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "metaCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL,
    "effectiveStatus" TEXT,
    "objective" TEXT,
    "dailyBudgetMinor" INTEGER NOT NULL,
    "statusSource" "ChangeActor" NOT NULL DEFAULT 'META',
    "adAccountId" TEXT NOT NULL,
    "productId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" TEXT NOT NULL,
    "metaAdSetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL,
    "dailyBudgetMinor" INTEGER,
    "optimizationGoal" TEXT,
    "billingEvent" TEXT,
    "targeting" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "metaCreativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "CreativeFormat" NOT NULL,
    "thumbnailUrl" TEXT,
    "productId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCreative" (
    "campaignId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,

    CONSTRAINT "CampaignCreative_pkey" PRIMARY KEY ("campaignId","creativeId")
);

-- CreateTable
CREATE TABLE "InsightSnapshot" (
    "id" TEXT NOT NULL,
    "level" "InsightLevel" NOT NULL,
    "window" TEXT NOT NULL,
    "campaignId" TEXT,
    "creativeId" TEXT,
    "adAccountId" TEXT,
    "spend" DECIMAL(65,30) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "cpm" DOUBLE PRECISION NOT NULL,
    "reach" INTEGER NOT NULL,
    "frequency" DOUBLE PRECISION NOT NULL,
    "roas" DOUBLE PRECISION NOT NULL,
    "purchases" INTEGER NOT NULL,
    "cpa" DOUBLE PRECISION NOT NULL,
    "cpp" DOUBLE PRECISION NOT NULL,
    "cpr" DOUBLE PRECISION NOT NULL,
    "audience" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ifCondition" TEXT NOT NULL,
    "thenAction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "on" BOOLEAN NOT NULL DEFAULT true,
    "metaRuleId" TEXT,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" "ChangeActor" NOT NULL,
    "userId" TEXT,
    "ruleId" TEXT,
    "type" "LogType" NOT NULL,
    "campaignId" TEXT,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "beforeVal" TEXT,
    "afterVal" TEXT,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_metaAccountId_key" ON "AdAccount"("metaAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_metaCampaignId_key" ON "Campaign"("metaCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdSet_metaAdSetId_key" ON "AdSet"("metaAdSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_metaCreativeId_key" ON "Creative"("metaCreativeId");

-- CreateIndex
CREATE INDEX "InsightSnapshot_level_window_campaignId_idx" ON "InsightSnapshot"("level", "window", "campaignId");

-- CreateIndex
CREATE INDEX "InsightSnapshot_level_window_creativeId_idx" ON "InsightSnapshot"("level", "window", "creativeId");

-- CreateIndex
CREATE INDEX "ActivityLog_occurredAt_idx" ON "ActivityLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "MetaToken" ADD CONSTRAINT "MetaToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAccount" ADD CONSTRAINT "ProductAccount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAccount" ADD CONSTRAINT "ProductAccount_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightSnapshot" ADD CONSTRAINT "InsightSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightSnapshot" ADD CONSTRAINT "InsightSnapshot_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
