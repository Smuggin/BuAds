-- Per-product "scale" targets for the judged KPI set (roas/ctr/cpm/cpp).
-- Nullable: existing rows fall back to a value derived from the limit at read time,
-- and are backfilled explicitly once the team edits them on the Product-KPI page.
ALTER TABLE "Product" ADD COLUMN "scaleRoas" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "scaleCtr" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "scaleCpm" INTEGER;
ALTER TABLE "Product" ADD COLUMN "scaleCpp" INTEGER;
