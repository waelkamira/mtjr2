CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN');
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'SHIPPED', 'RECEIVED', 'CANCELLED');

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "address" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Warehouse_storeId_code_key" ON "Warehouse"("storeId", "code");
CREATE INDEX "Warehouse_storeId_isActive_name_idx" ON "Warehouse"("storeId", "isActive", "name");
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Inventory" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "quantityReserved" INTEGER NOT NULL DEFAULT 0,
  "reorderPoint" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Inventory_nonnegative_check" CHECK ("quantityOnHand" >= 0 AND "quantityReserved" >= 0 AND "quantityReserved" <= "quantityOnHand" AND "reorderPoint" >= 0)
);
CREATE UNIQUE INDEX "Inventory_warehouseId_variantId_key" ON "Inventory"("warehouseId", "variantId");
CREATE INDEX "Inventory_variantId_warehouseId_idx" ON "Inventory"("variantId", "warehouseId");
CREATE INDEX "Inventory_warehouseId_quantityOnHand_quantityReserved_idx" ON "Inventory"("warehouseId", "quantityOnHand", "quantityReserved");
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "type" "InventoryMovementType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "referenceType" VARCHAR(40),
  "referenceId" VARCHAR(128),
  "idempotencyKey" VARCHAR(160),
  "note" VARCHAR(500),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");
CREATE INDEX "InventoryMovement_inventoryId_createdAt_idx" ON "InventoryMovement"("inventoryId", "createdAt");
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InventoryReservation" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "referenceType" VARCHAR(40) NOT NULL,
  "referenceId" VARCHAR(128) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryReservation_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "InventoryReservation_idempotencyKey_key" ON "InventoryReservation"("idempotencyKey");
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");
CREATE INDEX "InventoryReservation_inventoryId_status_idx" ON "InventoryReservation"("inventoryId", "status");
CREATE INDEX "InventoryReservation_referenceType_referenceId_idx" ON "InventoryReservation"("referenceType", "referenceId");
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockTransfer" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "sourceWarehouseId" TEXT NOT NULL,
  "destinationWarehouseId" TEXT NOT NULL,
  "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" VARCHAR(100),
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "createdById" TEXT,
  "shippedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransfer_different_warehouses_check" CHECK ("sourceWarehouseId" <> "destinationWarehouseId")
);
CREATE UNIQUE INDEX "StockTransfer_idempotencyKey_key" ON "StockTransfer"("idempotencyKey");
CREATE INDEX "StockTransfer_storeId_status_createdAt_idx" ON "StockTransfer"("storeId", "status", "createdAt");
CREATE INDEX "StockTransfer_sourceWarehouseId_status_idx" ON "StockTransfer"("sourceWarehouseId", "status");
CREATE INDEX "StockTransfer_destinationWarehouseId_status_idx" ON "StockTransfer"("destinationWarehouseId", "status");
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockTransferItem" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransferItem_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "StockTransferItem_transferId_variantId_key" ON "StockTransferItem"("transferId", "variantId");
CREATE INDEX "StockTransferItem_variantId_idx" ON "StockTransferItem"("variantId");
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
