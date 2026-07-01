-- Per-product close policy: replace autoClose Boolean with a 3-way CloseMode enum.
CREATE TYPE "CloseMode" AS ENUM ('OFF', 'SUGGEST', 'AUTO');

ALTER TABLE "Product" ADD COLUMN "closeMode" "CloseMode" NOT NULL DEFAULT 'SUGGEST';

-- Backfill: auto-close ON → SUGGEST (advisory), OFF → OFF.
UPDATE "Product"
SET "closeMode" = CASE WHEN "autoClose" = false THEN 'OFF'::"CloseMode" ELSE 'SUGGEST'::"CloseMode" END;

ALTER TABLE "Product" DROP COLUMN "autoClose";
