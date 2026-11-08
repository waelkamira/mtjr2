DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Store"
    GROUP BY "sellerId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one store per seller: duplicate sellerId values exist in Store. Consolidate duplicate stores without deleting business data, then rerun this migration.';
  END IF;
END $$;

DROP INDEX IF EXISTS "Store_sellerId_status_idx";

CREATE UNIQUE INDEX "Store_sellerId_key" ON "Store"("sellerId");

ALTER TABLE "Product"
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "district" VARCHAR(120),
  ADD COLUMN "contactPhone" VARCHAR(40),
  ADD COLUMN "videoUrl" VARCHAR(2048),
  ADD COLUMN "customFields" JSONB;
