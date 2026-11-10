-- Enforce the marketplace rule that each seller owns at most one store.
-- Refuse to guess how to consolidate legacy stores because orders, products,
-- inventory and payouts may be attached to them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Store"
    GROUP BY "sellerId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one store per seller: duplicate sellerId values exist in Store. Consolidate duplicate stores while preserving business records, then rerun this migration.';
  END IF;
END $$;

DROP INDEX IF EXISTS "Store_sellerId_status_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Store_sellerId_key" ON "Store"("sellerId");
