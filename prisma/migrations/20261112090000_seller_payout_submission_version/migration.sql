-- Bind manual payout reviews to a stable submission generation.
-- Existing payout destinations begin at generation 1; re-registration increments it.
ALTER TABLE "SellerPayoutMethod"
ADD COLUMN "submissionVersion" INTEGER NOT NULL DEFAULT 1;
