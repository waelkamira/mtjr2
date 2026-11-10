ALTER TYPE "AdInvoiceStatus" ADD VALUE 'SETTLED';
ALTER TABLE "AdInvoice"
  ADD COLUMN "paymentReference" VARCHAR(180),
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "settledById" TEXT,
  ADD CONSTRAINT "AdInvoice_settledBy_fkey"
    FOREIGN KEY ("settledById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AdInvoice_settledById_idx" ON "AdInvoice"("settledById");
