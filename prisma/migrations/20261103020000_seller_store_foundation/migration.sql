-- Seller and store foundation. Store staff authorization reuses scoped UserRoleAssignment grants.
CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "StoreStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "SellerStaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "Seller" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
  "legalName" TEXT,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Store" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "name" TEXT NOT NULL,
  "status" "StoreStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StoreMarket" (
  "storeId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreMarket_pkey" PRIMARY KEY ("storeId", "marketId")
);
CREATE TABLE "SellerStaff" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitedById" TEXT,
  "status" "SellerStaffStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Seller_ownerId_key" ON "Seller"("ownerId");
CREATE INDEX "Seller_status_createdAt_idx" ON "Seller"("status", "createdAt");
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");
CREATE INDEX "Store_sellerId_status_idx" ON "Store"("sellerId", "status");
CREATE INDEX "Store_status_createdAt_idx" ON "Store"("status", "createdAt");
CREATE INDEX "StoreMarket_marketId_isEnabled_idx" ON "StoreMarket"("marketId", "isEnabled");
CREATE UNIQUE INDEX "SellerStaff_storeId_userId_key" ON "SellerStaff"("storeId", "userId");
CREATE INDEX "SellerStaff_userId_status_idx" ON "SellerStaff"("userId", "status");
CREATE INDEX "SellerStaff_storeId_status_idx" ON "SellerStaff"("storeId", "status");

ALTER TABLE "Seller" ADD CONSTRAINT "Seller_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Store" ADD CONSTRAINT "Store_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMarket" ADD CONSTRAINT "StoreMarket_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreMarket" ADD CONSTRAINT "StoreMarket_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerStaff" ADD CONSTRAINT "SellerStaff_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
