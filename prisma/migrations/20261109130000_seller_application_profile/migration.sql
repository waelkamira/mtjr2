-- Structured seller onboarding profile, adapted from the Akaar application workflow.
-- All fields are nullable so existing seller records remain valid and no existing data is rewritten.
ALTER TABLE "Seller"
  ADD COLUMN "contactName" VARCHAR(120),
  ADD COLUMN "contactEmail" VARCHAR(254),
  ADD COLUMN "phoneNumber" VARCHAR(25),
  ADD COLUMN "residence" VARCHAR(240),
  ADD COLUMN "businessType" VARCHAR(24),
  ADD COLUMN "sellingCategories" VARCHAR(300),
  ADD COLUMN "intendedProducts" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "facebookUrl" VARCHAR(2048),
  ADD COLUMN "youtubeUrl" VARCHAR(2048),
  ADD COLUMN "twitterUrl" VARCHAR(2048),
  ADD COLUMN "identityDocumentFileId" VARCHAR(255),
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "Seller"
  ADD CONSTRAINT "Seller_businessType_check"
    CHECK ("businessType" IS NULL OR "businessType" IN ('INDIVIDUAL', 'STORE', 'ARTISAN', 'AGENCY', 'OTHER')),
  ADD CONSTRAINT "Seller_coordinates_pair_check"
    CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)),
  ADD CONSTRAINT "Seller_latitude_range_check"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
  ADD CONSTRAINT "Seller_longitude_range_check"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));
