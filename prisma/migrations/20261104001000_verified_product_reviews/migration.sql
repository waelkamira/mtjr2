CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');

CREATE TABLE "ProductReview" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "ProductReview_body_check" CHECK (length(trim("body")) >= 20)
);

CREATE UNIQUE INDEX "ProductReview_orderItemId_key" ON "ProductReview"("orderItemId");
CREATE UNIQUE INDEX "ProductReview_userId_productId_key" ON "ProductReview"("userId","productId");
CREATE INDEX "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId","status","createdAt");
CREATE INDEX "ProductReview_userId_createdAt_idx" ON "ProductReview"("userId","createdAt");
CREATE INDEX "ProductReview_status_createdAt_idx" ON "ProductReview"("status","createdAt");

ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoreReview" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vendorOrderId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "sellerResponse" VARCHAR(2000),
  "sellerRespondedAt" TIMESTAMP(3),
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "StoreReview_body_check" CHECK (length(trim("body")) >= 20)
);

CREATE UNIQUE INDEX "StoreReview_vendorOrderId_key" ON "StoreReview"("vendorOrderId");
CREATE UNIQUE INDEX "StoreReview_userId_storeId_key" ON "StoreReview"("userId","storeId");
CREATE INDEX "StoreReview_storeId_status_createdAt_idx" ON "StoreReview"("storeId","status","createdAt");
CREATE INDEX "StoreReview_userId_createdAt_idx" ON "StoreReview"("userId","createdAt");
CREATE INDEX "StoreReview_status_createdAt_idx" ON "StoreReview"("status","createdAt");

ALTER TABLE "StoreReview" ADD CONSTRAINT "StoreReview_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreReview" ADD CONSTRAINT "StoreReview_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreReview" ADD CONSTRAINT "StoreReview_vendorOrderId_fkey"
  FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
