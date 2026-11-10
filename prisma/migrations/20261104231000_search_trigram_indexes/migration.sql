CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_slug_trgm_idx"
  ON "Product" USING GIN ("slug" gin_trgm_ops);
CREATE INDEX "Product_description_trgm_idx"
  ON "Product" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "ProductTranslation_name_trgm_idx"
  ON "ProductTranslation" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Brand_name_trgm_idx"
  ON "Brand" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Category_name_trgm_idx"
  ON "Category" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Store_name_trgm_idx"
  ON "Store" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Seller_displayName_trgm_idx"
  ON "Seller" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "ProductVariant_sku_trgm_idx"
  ON "ProductVariant" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "ProductIdentifier_value_trgm_idx"
  ON "ProductIdentifier" USING GIN ("value" gin_trgm_ops);
