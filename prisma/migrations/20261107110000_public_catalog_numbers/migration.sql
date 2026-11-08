CREATE SEQUENCE "Store_storeNumber_seq" AS BIGINT;
ALTER TABLE "Store"
  ADD COLUMN "storeNumber" BIGINT NOT NULL DEFAULT nextval('"Store_storeNumber_seq"');
ALTER SEQUENCE "Store_storeNumber_seq" OWNED BY "Store"."storeNumber";
CREATE UNIQUE INDEX "Store_storeNumber_key" ON "Store"("storeNumber");

CREATE SEQUENCE "Product_productNumber_seq" AS BIGINT;
ALTER TABLE "Product"
  ADD COLUMN "productNumber" BIGINT NOT NULL DEFAULT nextval('"Product_productNumber_seq"');
ALTER SEQUENCE "Product_productNumber_seq" OWNED BY "Product"."productNumber";
CREATE UNIQUE INDEX "Product_productNumber_key" ON "Product"("productNumber");
