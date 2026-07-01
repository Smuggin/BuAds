-- AlterTable
ALTER TABLE "Creative" ADD COLUMN     "adStatus" "AdStatus",
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "metaPostId" TEXT,
ADD COLUMN     "permalinkUrl" TEXT,
ADD COLUMN     "previewImageUrl" TEXT;

-- AlterTable
ALTER TABLE "InsightSnapshot" ADD COLUMN     "engagement" JSONB,
ADD COLUMN     "video" JSONB;
