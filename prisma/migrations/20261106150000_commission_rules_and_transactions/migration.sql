ALTER TABLE "OrderItem"
ADD COLUMN "commissionCategoryId" TEXT,
ADD COLUMN "commissionCategoryName" TEXT;

CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT,
    "categoryId" TEXT,
    "rateBasisPoints" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommissionRule_rateBasisPoints_check" CHECK ("rateBasisPoints" >= 0 AND "rateBasisPoints" <= 10000),
    CONSTRAINT "CommissionRule_effectiveWindow_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom")
);

CREATE TABLE "CommissionTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorOrderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "commissionRuleId" TEXT,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "ruleScopeType" VARCHAR(32) NOT NULL,
    "rateBasisPoints" INTEGER NOT NULL,
    "baseAmountMinor" BIGINT NOT NULL,
    "commissionMinor" BIGINT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommissionTransaction_rateBasisPoints_check" CHECK ("rateBasisPoints" >= 0 AND "rateBasisPoints" <= 10000),
    CONSTRAINT "CommissionTransaction_amounts_check" CHECK ("baseAmountMinor" >= 0 AND "commissionMinor" >= 0 AND "commissionMinor" <= "baseAmountMinor"),
    CONSTRAINT "CommissionTransaction_scope_check" CHECK ("ruleScopeType" IN ('GLOBAL', 'SELLER', 'CATEGORY', 'SELLER_CATEGORY', 'NONE'))
);

CREATE UNIQUE INDEX "CommissionTransaction_orderItemId_key" ON "CommissionTransaction"("orderItemId");
CREATE INDEX "CommissionRule_sellerId_categoryId_isActive_effectiveFrom_idx" ON "CommissionRule"("sellerId", "categoryId", "isActive", "effectiveFrom");
CREATE INDEX "CommissionRule_categoryId_isActive_effectiveFrom_idx" ON "CommissionRule"("categoryId", "isActive", "effectiveFrom");
CREATE INDEX "CommissionRule_isActive_effectiveFrom_idx" ON "CommissionRule"("isActive", "effectiveFrom");
CREATE INDEX "CommissionTransaction_orderId_idx" ON "CommissionTransaction"("orderId");
CREATE INDEX "CommissionTransaction_vendorOrderId_idx" ON "CommissionTransaction"("vendorOrderId");
CREATE INDEX "CommissionTransaction_storeId_createdAt_idx" ON "CommissionTransaction"("storeId", "createdAt");
CREATE INDEX "CommissionTransaction_sellerId_createdAt_idx" ON "CommissionTransaction"("sellerId", "createdAt");
CREATE INDEX "CommissionTransaction_commissionRuleId_idx" ON "CommissionTransaction"("commissionRuleId");
CREATE INDEX "OrderItem_commissionCategoryId_idx" ON "OrderItem"("commissionCategoryId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_commissionCategoryId_fkey"
FOREIGN KEY ("commissionCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_vendorOrderId_fkey"
FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_commissionRuleId_fkey"
FOREIGN KEY ("commissionRuleId") REFERENCES "CommissionRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionTransaction" ADD CONSTRAINT "CommissionTransaction_currencyCode_fkey"
FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
