CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'MERGED', 'CHECKED_OUT', 'ABANDONED');

CREATE TABLE "GuestSession" (
  "id" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "guestSessionId" TEXT,
  "marketId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cart_exactly_one_owner_check" CHECK (
    (("userId" IS NOT NULL AND "guestSessionId" IS NULL) OR ("userId" IS NULL AND "guestSessionId" IS NOT NULL))
  )
);
CREATE UNIQUE INDEX "Cart_userId_marketId_currencyCode_status_key" ON "Cart"("userId", "marketId", "currencyCode", "status");
CREATE UNIQUE INDEX "Cart_guestSessionId_marketId_currencyCode_status_key" ON "Cart"("guestSessionId", "marketId", "currencyCode", "status");
CREATE INDEX "Cart_userId_status_updatedAt_idx" ON "Cart"("userId", "status", "updatedAt");
CREATE INDEX "Cart_guestSessionId_status_updatedAt_idx" ON "Cart"("guestSessionId", "status", "updatedAt");
CREATE INDEX "Cart_marketId_currencyCode_status_idx" ON "Cart"("marketId", "currencyCode", "status");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99)
);
CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
