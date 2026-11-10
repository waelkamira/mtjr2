CREATE TYPE "AttributeValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

CREATE TABLE "AttributeDefinition" (
  "id" TEXT NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "valueType" "AttributeValueType" NOT NULL,
  "isVariantLevel" BOOLEAN NOT NULL DEFAULT false,
  "isFilterable" BOOLEAN NOT NULL DEFAULT false,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributeTranslation" (
  "id" TEXT NOT NULL,
  "attributeDefinitionId" TEXT NOT NULL,
  "locale" VARCHAR(16) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttributeTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductAttribute" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "attributeDefinitionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductAttributeValue" (
  "id" TEXT NOT NULL,
  "productAttributeId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VariantAttribute" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "attributeDefinitionId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VariantAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttributeDefinition_key_key" ON "AttributeDefinition"("key");
CREATE INDEX "AttributeDefinition_isFilterable_valueType_idx" ON "AttributeDefinition"("isFilterable", "valueType");
CREATE UNIQUE INDEX "AttributeTranslation_attributeDefinitionId_locale_key" ON "AttributeTranslation"("attributeDefinitionId", "locale");
CREATE INDEX "AttributeTranslation_locale_name_idx" ON "AttributeTranslation"("locale", "name");
CREATE UNIQUE INDEX "ProductAttribute_productId_attributeDefinitionId_key" ON "ProductAttribute"("productId", "attributeDefinitionId");
CREATE INDEX "ProductAttribute_attributeDefinitionId_idx" ON "ProductAttribute"("attributeDefinitionId");
CREATE INDEX "ProductAttributeValue_productAttributeId_sortOrder_idx" ON "ProductAttributeValue"("productAttributeId", "sortOrder");
CREATE UNIQUE INDEX "VariantAttribute_variantId_attributeDefinitionId_key" ON "VariantAttribute"("variantId", "attributeDefinitionId");
CREATE INDEX "VariantAttribute_attributeDefinitionId_idx" ON "VariantAttribute"("attributeDefinitionId");

ALTER TABLE "AttributeTranslation" ADD CONSTRAINT "AttributeTranslation_attributeDefinitionId_fkey"
  FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeDefinitionId_fkey"
  FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productAttributeId_fkey"
  FOREIGN KEY ("productAttributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_attributeDefinitionId_fkey"
  FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
