CREATE TYPE "AdCampaignEventType" AS ENUM ('IMPRESSION','CLICK');
CREATE TYPE "AdInvoiceStatus" AS ENUM ('OPEN','VOID');

ALTER TABLE "AdCampaign"
  ADD COLUMN "marketId" TEXT,
  ADD COLUMN "currencyCode" CHAR(3),
  ADD COLUMN "targetCategoryId" TEXT,
  ADD COLUMN "targetBrandId" TEXT,
  ADD COLUMN "targetKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "budgetMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "dailyBudgetMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "cpcBidMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "spentMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "impressionCount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "clickCount" BIGINT NOT NULL DEFAULT 0;

-- Existing campaign drafts have no agreed budget/currency. Keep them non-deliverable
-- until the seller edits them through the new budget-aware draft workflow.
UPDATE "AdCampaign" SET "status" = 'PAUSED' WHERE "status" = 'ACTIVE';
UPDATE "AdCampaign" SET "marketId" = (
  SELECT sm."marketId" FROM "StoreMarket" sm WHERE sm."storeId" = "AdCampaign"."storeId" AND sm."isEnabled" = true ORDER BY sm."marketId" LIMIT 1
);
UPDATE "AdCampaign" SET "currencyCode" = (
  SELECT m."defaultCurrencyCode" FROM "Market" m WHERE m.id = "AdCampaign"."marketId"
);
-- Preserve old drafts safely; required budget fields are initialized to zero so they cannot spend.
ALTER TABLE "AdCampaign"
  ADD CONSTRAINT "AdCampaign_budget_valid" CHECK ("budgetMinor" >= 0 AND "dailyBudgetMinor" >= 0 AND "cpcBidMinor" >= 0 AND "spentMinor" >= 0 AND "spentMinor" <= "budgetMinor"),
  ADD CONSTRAINT "AdCampaign_daily_budget_valid" CHECK ("dailyBudgetMinor" <= "budgetMinor"),
  ADD CONSTRAINT "AdCampaign_market_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AdCampaign_currency_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"(code) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AdCampaign_targetCategory_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "Category"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AdCampaign_targetBrand_fkey" FOREIGN KEY ("targetBrandId") REFERENCES "Brand"(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AdCampaign_marketId_status_startsAt_endsAt_idx" ON "AdCampaign"("marketId","status","startsAt","endsAt");
CREATE INDEX "AdCampaign_targetCategoryId_targetBrandId_status_idx" ON "AdCampaign"("targetCategoryId","targetBrandId","status");

CREATE TABLE "AdCampaignEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "eventId" VARCHAR(80) NOT NULL,
  "type" "AdCampaignEventType" NOT NULL,
  "visitorHash" CHAR(64),
  "costMinor" BIGINT NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdCampaignEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdCampaignEvent_campaign_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdCampaignEvent_campaignId_eventId_key" ON "AdCampaignEvent"("campaignId","eventId");
CREATE INDEX "AdCampaignEvent_campaignId_type_occurredAt_idx" ON "AdCampaignEvent"("campaignId","type","occurredAt");

CREATE TABLE "AdSpendLedgerEntry" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdSpendLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdSpendLedgerEntry_campaign_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdSpendLedgerEntry_event_fkey" FOREIGN KEY ("eventId") REFERENCES "AdCampaignEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdSpendLedgerEntry_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdSpendLedgerEntry_currency_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdSpendLedgerEntry_amount_valid" CHECK ("amountMinor" > 0)
);
CREATE UNIQUE INDEX "AdSpendLedgerEntry_eventId_key" ON "AdSpendLedgerEntry"("eventId");
CREATE INDEX "AdSpendLedgerEntry_storeId_currencyCode_createdAt_idx" ON "AdSpendLedgerEntry"("storeId","currencyCode","createdAt");
CREATE INDEX "AdSpendLedgerEntry_campaignId_createdAt_idx" ON "AdSpendLedgerEntry"("campaignId","createdAt");

CREATE TABLE "AdInvoice" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "status" "AdInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdInvoice_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdInvoice_currency_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdInvoice_period_valid" CHECK ("periodStart" < "periodEnd" AND "amountMinor" > 0)
);
CREATE UNIQUE INDEX "AdInvoice_store_currency_period_key" ON "AdInvoice"("storeId","currencyCode","periodStart");
CREATE INDEX "AdInvoice_status_dueAt_idx" ON "AdInvoice"("status","dueAt");
