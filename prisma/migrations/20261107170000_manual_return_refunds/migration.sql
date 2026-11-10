CREATE TYPE "RefundStatus" AS ENUM ('PENDING_MANUAL', 'COMPLETED');

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING_MANUAL',
  "amountMinor" BIGINT NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "externalReference" VARCHAR(180),
  "note" VARCHAR(1000),
  "requestedById" TEXT NOT NULL,
  "completedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Refund_amountMinor_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "RefundItem" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "returnItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "RefundItem_amountMinor_positive" CHECK ("amountMinor" > 0)
);

CREATE UNIQUE INDEX "Refund_returnRequestId_key" ON "Refund"("returnRequestId");
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE UNIQUE INDEX "Refund_externalReference_key" ON "Refund"("externalReference");
CREATE INDEX "Refund_paymentId_status_createdAt_idx" ON "Refund"("paymentId", "status", "createdAt");
CREATE INDEX "Refund_status_requestedAt_idx" ON "Refund"("status", "requestedAt");
CREATE UNIQUE INDEX "RefundItem_returnItemId_key" ON "RefundItem"("returnItemId");
CREATE INDEX "RefundItem_refundId_idx" ON "RefundItem"("refundId");

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundItem"
  ADD CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RefundItem_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
