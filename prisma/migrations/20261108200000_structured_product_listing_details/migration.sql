-- Structured listing metadata for seller-created products.
-- Earlier listing migrations may already have introduced some of these objects.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "district" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "contactPhone" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "videoUrl" VARCHAR(2048);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyType') THEN
    CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyListingType') THEN
    CREATE TYPE "PropertyListingType" AS ENUM ('SALE', 'RENT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProductPropertyDetails" (
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

INSERT INTO "Category" ("id", "slug", "name", "description", "status", "sortOrder", "createdAt", "updatedAt")
VALUES ('builtin-real-estate', 'real-estate', 'Real Estate', 'Properties for sale or rent.', 'ACTIVE', 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT 'builtin-real-estate-ar', "id", 'ar', 'العقارات', 'عقارات للبيع أو الإيجار.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Category"
WHERE "slug" = 'real-estate'
ON CONFLICT ("categoryId", "locale") DO NOTHING;
