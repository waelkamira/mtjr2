ALTER TYPE "InventoryMovementType" ADD VALUE 'ORDER_CANCELLATION';

CREATE TYPE "ShipmentTrackingStatus" AS ENUM (
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'EXCEPTION'
);

CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "vendorOrderId" TEXT NOT NULL,
  "carrierName" VARCHAR(120) NOT NULL,
  "trackingNumber" VARCHAR(120) NOT NULL,
  "trackingUrl" VARCHAR(2000),
  "status" "ShipmentTrackingStatus" NOT NULL DEFAULT 'SHIPPED',
  "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentTrackingEvent" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "status" "ShipmentTrackingStatus" NOT NULL,
  "description" VARCHAR(500),
  "location" VARCHAR(160),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentTrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_vendorOrderId_key" ON "Shipment"("vendorOrderId");
CREATE INDEX "Shipment_status_shippedAt_idx" ON "Shipment"("status", "shippedAt");
CREATE INDEX "ShipmentTrackingEvent_shipmentId_occurredAt_idx" ON "ShipmentTrackingEvent"("shipmentId", "occurredAt");

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_vendorOrderId_fkey"
  FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentTrackingEvent"
  ADD CONSTRAINT "ShipmentTrackingEvent_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
