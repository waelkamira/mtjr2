CREATE TYPE "ProductApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "brandId" TEXT,
  "slug" VARCHAR(180) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "CatalogEntityStatus" NOT NULL DEFAULT 'DRAFT',
  "approvalStatus" "ProductApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductCategory" (
  "productId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId", "categoryId")
);

CREATE TABLE "ProductTranslation" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locale" VARCHAR(16) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductMedia" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "ProductMediaType" NOT NULL DEFAULT 'IMAGE',
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "altText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "barcode" VARCHAR(100),
  "name" TEXT,
  "optionValues" JSONB,
  "weightGrams" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductIdentifier" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "identifierType" VARCHAR(32) NOT NULL,
  "value" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductPrice" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "compareAtMinor" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductPrice_amountMinor_check" CHECK ("amountMinor" >= 0),
  CONSTRAINT "ProductPrice_compareAtMinor_check" CHECK ("compareAtMinor" IS NULL OR "compareAtMinor" >= "amountMinor")
);

CREATE UNIQUE INDEX "Product_storeId_slug_key" ON "Product"("storeId", "slug");
CREATE INDEX "Product_storeId_status_approvalStatus_createdAt_idx" ON "Product"("storeId", "status", "approvalStatus", "createdAt");
CREATE INDEX "Product_brandId_status_idx" ON "Product"("brandId", "status");
CREATE INDEX "ProductCategory_categoryId_productId_idx" ON "ProductCategory"("categoryId", "productId");
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");
CREATE INDEX "ProductTranslation_locale_name_idx" ON "ProductTranslation"("locale", "name");
CREATE INDEX "ProductMedia_productId_sortOrder_idx" ON "ProductMedia"("productId", "sortOrder");
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE UNIQUE INDEX "ProductVariant_barcode_key" ON "ProductVariant"("barcode");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");
CREATE UNIQUE INDEX "ProductIdentifier_identifierType_value_key" ON "ProductIdentifier"("identifierType", "value");
CREATE INDEX "ProductIdentifier_productId_idx" ON "ProductIdentifier"("productId");
CREATE UNIQUE INDEX "ProductPrice_variantId_marketId_currencyCode_key" ON "ProductPrice"("variantId", "marketId", "currencyCode");
CREATE INDEX "ProductPrice_marketId_currencyCode_amountMinor_idx" ON "ProductPrice"("marketId", "currencyCode", "amountMinor");

ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_currencyCode_fkey"
  FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
