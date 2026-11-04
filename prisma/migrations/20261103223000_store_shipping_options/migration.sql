-- Add store ownership to immutable quote lines so multi-vendor shipping is calculated per store.
ALTER TABLE "CheckoutQuoteLine" ADD COLUMN "storeId" TEXT;
UPDATE "CheckoutQuoteLine" AS line
SET "storeId" = product."storeId"
FROM "ProductVariant" AS variant
JOIN "Product" AS product ON product."id" = variant."productId"
WHERE line."variantId" = variant."id";
ALTER TABLE "CheckoutQuoteLine" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "CheckoutQuoteLine"
  ADD CONSTRAINT "CheckoutQuoteLine_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CheckoutQuoteLine_storeId_idx" ON "CheckoutQuoteLine"("storeId");

CREATE TABLE "StoreShippingRate" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "amountMinor" BIGINT NOT NULL,
  "destinationRegion" VARCHAR(120),
  "minDeliveryDays" INTEGER,
  "maxDeliveryDays" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreShippingRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreShippingRate_amountMinor_check" CHECK ("amountMinor" >= 0),
  CONSTRAINT "StoreShippingRate_delivery_days_check" CHECK (
    ("minDeliveryDays" IS NULL OR "minDeliveryDays" >= 0) AND
    ("maxDeliveryDays" IS NULL OR "maxDeliveryDays" >= 0) AND
    ("minDeliveryDays" IS NULL OR "maxDeliveryDays" IS NULL OR "maxDeliveryDays" >= "minDeliveryDays")
  ),
  CONSTRAINT "StoreShippingRate_effective_dates_check" CHECK (
    "effectiveFrom" IS NULL OR "effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"
  )
);
CREATE INDEX "StoreShippingRate_storeId_marketId_isActive_priority_idx"
  ON "StoreShippingRate"("storeId", "marketId", "isActive", "priority");
CREATE INDEX "StoreShippingRate_marketId_currencyCode_isActive_idx"
  ON "StoreShippingRate"("marketId", "currencyCode", "isActive");
CREATE INDEX "StoreShippingRate_effectiveFrom_effectiveUntil_idx"
  ON "StoreShippingRate"("effectiveFrom", "effectiveUntil");
ALTER TABLE "StoreShippingRate"
  ADD CONSTRAINT "StoreShippingRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoreShippingRate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StoreShippingRate_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CheckoutShippingSelection" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "shippingRateId" TEXT,
  "serviceName" VARCHAR(120) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "destinationRegion" VARCHAR(120),
  "minDeliveryDays" INTEGER,
  "maxDeliveryDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutShippingSelection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutShippingSelection_amountMinor_check" CHECK ("amountMinor" >= 0)
);
CREATE UNIQUE INDEX "CheckoutShippingSelection_quoteId_storeId_key"
  ON "CheckoutShippingSelection"("quoteId", "storeId");
CREATE INDEX "CheckoutShippingSelection_storeId_createdAt_idx"
  ON "CheckoutShippingSelection"("storeId", "createdAt");
CREATE INDEX "CheckoutShippingSelection_shippingRateId_idx"
  ON "CheckoutShippingSelection"("shippingRateId");
ALTER TABLE "CheckoutShippingSelection"
  ADD CONSTRAINT "CheckoutShippingSelection_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CheckoutShippingSelection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CheckoutShippingSelection_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "StoreShippingRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
