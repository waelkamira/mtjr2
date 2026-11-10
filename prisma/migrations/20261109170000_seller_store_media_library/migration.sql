CREATE TABLE "StoreMediaAsset" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  "storageKey" VARCHAR(512),
  "mimeType" VARCHAR(100),
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreMediaAsset_storageKey_key" ON "StoreMediaAsset"("storageKey");
CREATE INDEX "StoreMediaAsset_storeId_createdAt_idx" ON "StoreMediaAsset"("storeId", "createdAt");
ALTER TABLE "StoreMediaAsset" ADD CONSTRAINT "StoreMediaAsset_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
