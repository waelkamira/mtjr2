-- Structured listing metadata for seller-created products.
ALTER TABLE "Product"
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "district" VARCHAR(120),
  ADD COLUMN "contactPhone" VARCHAR(40),
  ADD COLUMN "videoUrl" VARCHAR(2048);

CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL');
CREATE TYPE "PropertyListingType" AS ENUM ('SALE', 'RENT');

CREATE TABLE "ProductMapLocation" (
  "productId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "publicLatitude" DOUBLE PRECISION NOT NULL,
  "publicLongitude" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductMapLocation_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductMapLocation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProductPropertyDetails" (
  "productId" TEXT NOT NULL,
  "propertyType" "PropertyType" NOT NULL,
  "listingType" "PropertyListingType" NOT NULL,
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "floorArea" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductPropertyDetails_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ProductPropertyDetails_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductPropertyDetails_floorArea_check" CHECK ("floorArea" > 0),
  CONSTRAINT "ProductPropertyDetails_bedrooms_check" CHECK ("bedrooms" IS NULL OR "bedrooms" >= 0),
  CONSTRAINT "ProductPropertyDetails_bathrooms_check" CHECK ("bathrooms" IS NULL OR "bathrooms" >= 0)
);
