CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "vendorOrderId" TEXT NOT NULL,
  "carrierName" VARCHAR(120) NOT NULL,
  "trackingNumber" VARCHAR(160) NOT NULL,
  "trackingUrl" VARCHAR(2048),
  "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Shipment_carrier_nonempty_check" CHECK (length(trim("carrierName")) >= 2),
  CONSTRAINT "Shipment_tracking_nonempty_check" CHECK (length(trim("trackingNumber")) >= 3),
  CONSTRAINT "Shipment_tracking_url_https_check" CHECK ("trackingUrl" IS NULL OR "trackingUrl" LIKE 'https://%')
);

CREATE UNIQUE INDEX "Shipment_vendorOrderId_key" ON "Shipment"("vendorOrderId");
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");
CREATE INDEX "Shipment_shippedAt_idx" ON "Shipment"("shippedAt");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_vendorOrderId_fkey"
FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
