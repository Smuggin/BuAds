-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "skipMetrics" TEXT[] DEFAULT ARRAY[]::TEXT[];
