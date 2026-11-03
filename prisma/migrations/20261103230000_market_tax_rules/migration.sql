CREATE TABLE "MarketTaxRate" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "destinationRegion" VARCHAR(120),
  "rateBasisPoints" INTEGER NOT NULL,
  "isInclusive" BOOLEAN NOT NULL DEFAULT false,
  "appliesToShipping" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketTaxRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketTaxRate_rateBasisPoints_check" CHECK ("rateBasisPoints" >= 0 AND "rateBasisPoints" <= 100000),
  CONSTRAINT "MarketTaxRate_effectiveDates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom")
);

CREATE TABLE "CheckoutTaxSnapshot" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "taxRateId" TEXT,
  "ruleName" VARCHAR(120) NOT NULL,
  "rateBasisPoints" INTEGER NOT NULL,
  "taxableAmountMinor" BIGINT NOT NULL,
  "taxAmountMinor" BIGINT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "isInclusive" BOOLEAN NOT NULL,
  "includesShipping" BOOLEAN NOT NULL,
  "destinationRegion" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutTaxSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutTaxSnapshot_quoteId_key" UNIQUE ("quoteId"),
  CONSTRAINT "CheckoutTaxSnapshot_rateBasisPoints_check" CHECK ("rateBasisPoints" >= 0 AND "rateBasisPoints" <= 100000),
  CONSTRAINT "CheckoutTaxSnapshot_amounts_check" CHECK ("taxableAmountMinor" >= 0 AND "taxAmountMinor" >= 0)
);

CREATE INDEX "MarketTaxRate_marketId_isActive_priority_idx" ON "MarketTaxRate"("marketId", "isActive", "priority");
CREATE INDEX "MarketTaxRate_marketId_destinationRegion_isActive_idx" ON "MarketTaxRate"("marketId", "destinationRegion", "isActive");
CREATE INDEX "MarketTaxRate_effectiveFrom_effectiveUntil_idx" ON "MarketTaxRate"("effectiveFrom", "effectiveUntil");
CREATE INDEX "CheckoutTaxSnapshot_taxRateId_idx" ON "CheckoutTaxSnapshot"("taxRateId");

ALTER TABLE "MarketTaxRate" ADD CONSTRAINT "MarketTaxRate_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutTaxSnapshot" ADD CONSTRAINT "CheckoutTaxSnapshot_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutTaxSnapshot" ADD CONSTRAINT "CheckoutTaxSnapshot_taxRateId_fkey"
  FOREIGN KEY ("taxRateId") REFERENCES "MarketTaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
