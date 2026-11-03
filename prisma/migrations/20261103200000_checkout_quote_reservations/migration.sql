CREATE TYPE "CheckoutQuoteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED');

CREATE TABLE "CheckoutQuote" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "userId" TEXT,
  "guestSessionId" TEXT,
  "marketId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "status" "CheckoutQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
  "subtotalMinor" BIGINT NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutQuote_exactly_one_owner_check" CHECK (
    ("userId" IS NOT NULL AND "guestSessionId" IS NULL) OR
    ("userId" IS NULL AND "guestSessionId" IS NOT NULL)
  ),
  CONSTRAINT "CheckoutQuote_subtotal_nonnegative_check" CHECK ("subtotalMinor" >= 0)
);
CREATE UNIQUE INDEX "CheckoutQuote_idempotencyKey_key" ON "CheckoutQuote"("idempotencyKey");
CREATE INDEX "CheckoutQuote_cartId_status_expiresAt_idx" ON "CheckoutQuote"("cartId", "status", "expiresAt");
CREATE INDEX "CheckoutQuote_userId_status_expiresAt_idx" ON "CheckoutQuote"("userId", "status", "expiresAt");
CREATE INDEX "CheckoutQuote_guestSessionId_status_expiresAt_idx" ON "CheckoutQuote"("guestSessionId", "status", "expiresAt");
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CheckoutQuoteLine" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "variantName" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitAmountMinor" BIGINT NOT NULL,
  "lineTotalMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutQuoteLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutQuoteLine_quantity_positive_check" CHECK ("quantity" > 0),
  CONSTRAINT "CheckoutQuoteLine_amounts_nonnegative_check" CHECK ("unitAmountMinor" >= 0 AND "lineTotalMinor" >= 0)
);
CREATE UNIQUE INDEX "CheckoutQuoteLine_quoteId_variantId_key" ON "CheckoutQuoteLine"("quoteId", "variantId");
CREATE INDEX "CheckoutQuoteLine_variantId_idx" ON "CheckoutQuoteLine"("variantId");
ALTER TABLE "CheckoutQuoteLine" ADD CONSTRAINT "CheckoutQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutQuoteLine" ADD CONSTRAINT "CheckoutQuoteLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_quantity_positive_check" CHECK ("quantity" > 0);
