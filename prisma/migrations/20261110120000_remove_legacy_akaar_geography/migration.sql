-- Preserve any legacy suggestion label on the product before removing
-- the Akaar-derived reference table. The text value remains seller-editable.
UPDATE "Product" AS product
SET "neighborhood" = COALESCE(NULLIF(BTRIM(product."neighborhood"), ''), legacy."nameAr")
FROM "SyriaNeighborhood" AS legacy
WHERE product."neighborhoodId" = legacy."id"
  AND (product."neighborhood" IS NULL OR BTRIM(product."neighborhood") = '');

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_neighborhoodId_fkey";
DROP INDEX IF EXISTS "Product_neighborhoodId_idx";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "neighborhoodId";
DROP TABLE IF EXISTS "SyriaNeighborhood";
