ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE';

CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT','CONFIRMED','PROCESSING','PARTIALLY_FULFILLED','FULFILLED','CANCELLED','COMPLETED');
CREATE TYPE "VendorOrderStatus" AS ENUM ('PENDING_PAYMENT','CONFIRMED','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED','CANCELLED');

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "orderNumber" VARCHAR(32) NOT NULL,
  "quoteId" TEXT NOT NULL,
  "userId" TEXT,
  "guestSessionId" TEXT,
  "marketId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "subtotalMinor" BIGINT NOT NULL,
  "shippingMinor" BIGINT NOT NULL,
  "taxMinor" BIGINT NOT NULL,
  "taxRuleName" VARCHAR(120) NOT NULL,
  "taxRateBasisPoints" INTEGER NOT NULL,
  "taxInclusive" BOOLEAN NOT NULL,
  "taxIncludesShipping" BOOLEAN NOT NULL,
  "taxDestinationRegion" VARCHAR(120),
  "totalMinor" BIGINT NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_owner_check" CHECK ((("userId" IS NOT NULL)::int + ("guestSessionId" IS NOT NULL)::int) = 1),
  CONSTRAINT "Order_amounts_check" CHECK ("subtotalMinor" >= 0 AND "shippingMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0 AND "totalMinor" = "subtotalMinor" + "shippingMinor" + CASE WHEN "taxInclusive" THEN 0 ELSE "taxMinor" END)
);

CREATE TABLE "OrderAddress" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
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
  CONSTRAINT "OrderAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorOrder" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "status" "VendorOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "subtotalMinor" BIGINT NOT NULL,
  "shippingMinor" BIGINT NOT NULL,
  "taxMinor" BIGINT NOT NULL,
  "taxInclusive" BOOLEAN NOT NULL,
  "shippingServiceName" VARCHAR(120) NOT NULL,
  "shippingRateId" TEXT,
  "shippingDestinationRegion" VARCHAR(120),
  "minDeliveryDays" INTEGER,
  "maxDeliveryDays" INTEGER,
  "totalMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorOrder_amounts_check" CHECK ("subtotalMinor" >= 0 AND "shippingMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0 AND "totalMinor" = "subtotalMinor" + "shippingMinor" + CASE WHEN "taxInclusive" THEN 0 ELSE "taxMinor" END)
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "vendorOrderId" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "productName" TEXT NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "variantName" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitAmountMinor" BIGINT NOT NULL,
  "lineTotalMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItem_amounts_check" CHECK ("quantity" > 0 AND "unitAmountMinor" >= 0 AND "lineTotalMinor" = "unitAmountMinor" * "quantity")
);

CREATE TABLE "OrderStatusHistory" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "note" VARCHAR(500),
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorOrderStatusHistory" (
  "id" TEXT NOT NULL,
  "vendorOrderId" TEXT NOT NULL,
  "status" "VendorOrderStatus" NOT NULL,
  "note" VARCHAR(500),
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_quoteId_key" ON "Order"("quoteId");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE INDEX "Order_userId_placedAt_idx" ON "Order"("userId","placedAt");
CREATE INDEX "Order_guestSessionId_placedAt_idx" ON "Order"("guestSessionId","placedAt");
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status","placedAt");
CREATE UNIQUE INDEX "OrderAddress_orderId_key" ON "OrderAddress"("orderId");
CREATE UNIQUE INDEX "VendorOrder_orderId_storeId_key" ON "VendorOrder"("orderId","storeId");
CREATE INDEX "VendorOrder_storeId_status_createdAt_idx" ON "VendorOrder"("storeId","status","createdAt");
CREATE INDEX "VendorOrder_orderId_status_idx" ON "VendorOrder"("orderId","status");
CREATE INDEX "OrderItem_vendorOrderId_idx" ON "OrderItem"("vendorOrderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId","createdAt");
CREATE INDEX "VendorOrderStatusHistory_vendorOrderId_createdAt_idx" ON "VendorOrderStatusHistory"("vendorOrderId","createdAt");

ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CheckoutQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAddress" ADD CONSTRAINT "OrderAddress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorOrder" ADD CONSTRAINT "VendorOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorOrder" ADD CONSTRAINT "VendorOrder_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "StoreShippingRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorOrder" ADD CONSTRAINT "VendorOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorOrderStatusHistory" ADD CONSTRAINT "VendorOrderStatusHistory_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
