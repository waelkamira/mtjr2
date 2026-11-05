-- Track physically received return quantities separately from sellable on-hand stock.
ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN_RECEIPT';

ALTER TABLE "Inventory"
  ADD COLUMN "quantityQuarantined" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "InventoryMovement"
  ADD COLUMN "quarantinedDelta" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_quantityQuarantined_nonnegative"
  CHECK ("quantityQuarantined" >= 0);
