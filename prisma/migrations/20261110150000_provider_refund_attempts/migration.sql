ALTER TABLE "Refund" ADD COLUMN "providerAttempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_providerAttempt_check" CHECK ("providerAttempt" > 0);
