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
  CONSTRAINT "ProductPropertyDetails_bedrooms_check" CHECK ("bedrooms" IS NULL OR "bedrooms" >= 0),
  CONSTRAINT "ProductPropertyDetails_bathrooms_check" CHECK ("bathrooms" IS NULL OR "bathrooms" >= 0),
  CONSTRAINT "ProductPropertyDetails_floorArea_check" CHECK ("floorArea" > 0),
  CONSTRAINT "ProductPropertyDetails_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Category" ("id", "slug", "name", "description", "status", "sortOrder", "createdAt", "updatedAt")
VALUES ('builtin-real-estate', 'real-estate', 'Real Estate', 'Properties for sale or rent.', 'ACTIVE', 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT 'builtin-real-estate-ar', "id", 'ar', 'العقارات', 'عقارات للبيع أو الإيجار.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Category"
WHERE "slug" = 'real-estate'
ON CONFLICT ("categoryId", "locale") DO NOTHING;
