CREATE TABLE "CategoryAttribute" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "attributeDefinitionId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isVariantLevel" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_attributeDefinitionId_key" ON "CategoryAttribute"("categoryId", "attributeDefinitionId");
CREATE INDEX "CategoryAttribute_categoryId_sortOrder_idx" ON "CategoryAttribute"("categoryId", "sortOrder");
CREATE INDEX "CategoryAttribute_attributeDefinitionId_idx" ON "CategoryAttribute"("attributeDefinitionId");
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SyriaGovernorate" (
  "id" TEXT NOT NULL, "nameEn" TEXT NOT NULL, "nameAr" TEXT, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "sourceVersion" VARCHAR(20) NOT NULL, "sourceIds" TEXT[] NOT NULL, "aliases" JSONB, "sourceReferences" JSONB, "sourceStatus" VARCHAR(24),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyriaGovernorate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyriaGovernorate_nameAr_idx" ON "SyriaGovernorate"("nameAr");
CREATE INDEX "SyriaGovernorate_nameEn_idx" ON "SyriaGovernorate"("nameEn");

CREATE TABLE "SyriaDistrict" (
  "id" TEXT NOT NULL, "governorateId" TEXT NOT NULL, "nameEn" TEXT NOT NULL, "nameAr" TEXT, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "sourceVersion" VARCHAR(20) NOT NULL, "sourceIds" TEXT[] NOT NULL, "aliases" JSONB, "sourceReferences" JSONB, "sourceStatus" VARCHAR(24),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyriaDistrict_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyriaDistrict_governorateId_nameAr_idx" ON "SyriaDistrict"("governorateId", "nameAr");
CREATE INDEX "SyriaDistrict_governorateId_nameEn_idx" ON "SyriaDistrict"("governorateId", "nameEn");
ALTER TABLE "SyriaDistrict" ADD CONSTRAINT "SyriaDistrict_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "SyriaGovernorate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SyriaSubdistrict" (
  "id" TEXT NOT NULL, "governorateId" TEXT NOT NULL, "districtId" TEXT NOT NULL, "nameEn" TEXT NOT NULL, "nameAr" TEXT, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "sourceVersion" VARCHAR(20) NOT NULL, "sourceIds" TEXT[] NOT NULL, "aliases" JSONB, "sourceReferences" JSONB, "sourceStatus" VARCHAR(24),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyriaSubdistrict_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyriaSubdistrict_governorateId_districtId_nameAr_idx" ON "SyriaSubdistrict"("governorateId", "districtId", "nameAr");
CREATE INDEX "SyriaSubdistrict_districtId_nameEn_idx" ON "SyriaSubdistrict"("districtId", "nameEn");
ALTER TABLE "SyriaSubdistrict" ADD CONSTRAINT "SyriaSubdistrict_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "SyriaDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyriaSubdistrict" ADD CONSTRAINT "SyriaSubdistrict_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "SyriaGovernorate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SyriaLocality" (
  "id" TEXT NOT NULL, "governorateId" TEXT NOT NULL, "districtId" TEXT, "subdistrictId" TEXT,
  "nameEn" TEXT NOT NULL, "nameAr" TEXT, "kind" TEXT NOT NULL, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "sourceVersion" VARCHAR(20) NOT NULL, "sourceIds" TEXT[] NOT NULL, "aliases" JSONB, "sourceReferences" JSONB, "sourceStatus" VARCHAR(24),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyriaLocality_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyriaLocality_governorateId_districtId_subdistrictId_idx" ON "SyriaLocality"("governorateId", "districtId", "subdistrictId");
CREATE INDEX "SyriaLocality_subdistrictId_nameAr_idx" ON "SyriaLocality"("subdistrictId", "nameAr");
CREATE INDEX "SyriaLocality_subdistrictId_nameEn_idx" ON "SyriaLocality"("subdistrictId", "nameEn");
CREATE INDEX "SyriaLocality_kind_idx" ON "SyriaLocality"("kind");
ALTER TABLE "SyriaLocality" ADD CONSTRAINT "SyriaLocality_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "SyriaGovernorate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyriaLocality" ADD CONSTRAINT "SyriaLocality_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "SyriaDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyriaLocality" ADD CONSTRAINT "SyriaLocality_subdistrictId_fkey" FOREIGN KEY ("subdistrictId") REFERENCES "SyriaSubdistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "localityId" TEXT, ADD COLUMN "latitude" DOUBLE PRECISION, ADD COLUMN "longitude" DOUBLE PRECISION;
CREATE INDEX "Product_localityId_idx" ON "Product"("localityId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "SyriaLocality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
