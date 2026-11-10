-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3),
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "phoneCallingCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "minorUnit" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "Currency_minorUnit_check" CHECK ("minorUnit" >= 0 AND "minorUnit" <= 4)
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "defaultCurrencyCode" CHAR(3) NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketCurrency" (
    "marketId" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketCurrency_pkey" PRIMARY KEY ("marketId", "currencyCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");
CREATE INDEX "Country_isActive_name_idx" ON "Country"("isActive", "name");
CREATE INDEX "Currency_isActive_name_idx" ON "Currency"("isActive", "name");
CREATE UNIQUE INDEX "Market_code_key" ON "Market"("code");
CREATE INDEX "Market_countryId_status_idx" ON "Market"("countryId", "status");
CREATE INDEX "Market_defaultCurrencyCode_idx" ON "Market"("defaultCurrencyCode");
CREATE INDEX "MarketCurrency_currencyCode_isEnabled_idx" ON "MarketCurrency"("currencyCode", "isEnabled");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Market" ADD CONSTRAINT "Market_defaultCurrencyCode_fkey"
FOREIGN KEY ("defaultCurrencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketCurrency" ADD CONSTRAINT "MarketCurrency_marketId_fkey"
FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketCurrency" ADD CONSTRAINT "MarketCurrency_currencyCode_fkey"
FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
