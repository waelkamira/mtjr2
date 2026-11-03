CREATE TABLE "UserAddress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "countryId" TEXT NOT NULL,
  "label" VARCHAR(80),
  "recipientName" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "line1" VARCHAR(200) NOT NULL,
  "line2" VARCHAR(200),
  "city" VARCHAR(120) NOT NULL,
  "region" VARCHAR(120),
  "postalCode" VARCHAR(32),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserAddress_userId_isDefault_createdAt_idx" ON "UserAddress"("userId", "isDefault", "createdAt");
CREATE INDEX "UserAddress_countryId_idx" ON "UserAddress"("countryId");
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CheckoutQuoteAddress" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "sourceAddressId" TEXT,
  "recipientName" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "countryName" VARCHAR(120) NOT NULL,
  "line1" VARCHAR(200) NOT NULL,
  "line2" VARCHAR(200),
  "city" VARCHAR(120) NOT NULL,
  "region" VARCHAR(120),
  "postalCode" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutQuoteAddress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CheckoutQuoteAddress_quoteId_key" ON "CheckoutQuoteAddress"("quoteId");
CREATE INDEX "CheckoutQuoteAddress_sourceAddressId_idx" ON "CheckoutQuoteAddress"("sourceAddressId");
ALTER TABLE "CheckoutQuoteAddress" ADD CONSTRAINT "CheckoutQuoteAddress_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutQuoteAddress" ADD CONSTRAINT "CheckoutQuoteAddress_sourceAddressId_fkey" FOREIGN KEY ("sourceAddressId") REFERENCES "UserAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
