CREATE TYPE "StockCountStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "StockCountSession" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "status" "StockCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "note" VARCHAR(500),
  "createdById" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockCountSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockCountSession_storeId_status_openedAt_idx" ON "StockCountSession"("storeId", "status", "openedAt");
CREATE INDEX "StockCountSession_warehouseId_status_openedAt_idx" ON "StockCountSession"("warehouseId", "status", "openedAt");
ALTER TABLE "StockCountSession" ADD CONSTRAINT "StockCountSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockCountSession" ADD CONSTRAINT "StockCountSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockCountLine" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "expectedQuantity" INTEGER NOT NULL,
  "countedQuantity" INTEGER,
  "note" VARCHAR(500),
  "countedAt" TIMESTAMP(3),
  CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockCountLine_expectedQuantity_check" CHECK ("expectedQuantity" >= 0),
  CONSTRAINT "StockCountLine_countedQuantity_check" CHECK ("countedQuantity" IS NULL OR "countedQuantity" >= 0)
);
CREATE UNIQUE INDEX "StockCountLine_sessionId_inventoryId_key" ON "StockCountLine"("sessionId", "inventoryId");
CREATE INDEX "StockCountLine_sessionId_countedQuantity_idx" ON "StockCountLine"("sessionId", "countedQuantity");
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StockCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
