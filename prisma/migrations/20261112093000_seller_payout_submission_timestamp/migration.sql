-- Track the timestamp of the current seller payout submission generation.
-- Existing rows receive the migration timestamp; every re-registration sets a fresh timestamp.
ALTER TABLE "SellerPayoutMethod"
ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "SellerPayoutMethod_status_submittedAt_idx"
ON "SellerPayoutMethod"("status", "submittedAt");
