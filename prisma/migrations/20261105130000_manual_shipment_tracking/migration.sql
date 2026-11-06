ALTER TABLE "Shipment"
  ADD COLUMN "createdById" TEXT,
  ALTER COLUMN "trackingNumber" TYPE VARCHAR(160),
  ALTER COLUMN "trackingUrl" TYPE VARCHAR(2048);

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_carrier_nonempty_check" CHECK (length(trim("carrierName")) >= 2),
  ADD CONSTRAINT "Shipment_tracking_nonempty_check" CHECK (length(trim("trackingNumber")) >= 3),
  ADD CONSTRAINT "Shipment_tracking_url_https_check" CHECK ("trackingUrl" IS NULL OR "trackingUrl" LIKE 'https://%');

CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");
CREATE INDEX "Shipment_shippedAt_idx" ON "Shipment"("shippedAt");
