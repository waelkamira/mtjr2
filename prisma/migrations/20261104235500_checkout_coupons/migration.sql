CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "discountType" "CouponDiscountType" NOT NULL,
  "value" BIGINT NOT NULL,
  "currencyCode" CHAR(3),
  "maxRedemptions" INTEGER,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Coupon_value_check" CHECK (
    ("discountType" = 'PERCENTAGE' AND "value" > 0 AND "value" <= 10000 AND "currencyCode" IS NULL)
    OR ("discountType" = 'FIXED_AMOUNT' AND "value" > 0 AND "currencyCode" IS NOT NULL)
  ),
  CONSTRAINT "Coupon_maxRedemptions_check" CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" > 0),
  CONSTRAINT "Coupon_expiry_check" CHECK ("expiresAt" IS NULL OR "startsAt" IS NULL OR "expiresAt" > "startsAt")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_isActive_startsAt_expiresAt_idx" ON "Coupon"("isActive", "startsAt", "expiresAt");

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_currencyCode_fkey"
  FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CheckoutQuote"
  ADD COLUMN "couponId" TEXT,
  ADD COLUMN "couponCode" VARCHAR(40),
  ADD COLUMN "discountMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "CheckoutQuote"
  ADD CONSTRAINT "CheckoutQuote_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD COLUMN "couponId" TEXT,
  ADD COLUMN "couponCode" VARCHAR(40),
  ADD COLUMN "discountMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VendorOrder"
  ADD COLUMN "discountMinor" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_createdAt_idx" ON "CouponRedemption"("couponId", "createdAt");
CREATE INDEX "CouponRedemption_userId_createdAt_idx" ON "CouponRedemption"("userId", "createdAt");

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
