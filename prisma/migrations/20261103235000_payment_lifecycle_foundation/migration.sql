CREATE TYPE "PaymentStatus" AS ENUM (
  'INITIATING',
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'DISPUTED'
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATING',
  "amountMinor" BIGINT NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "providerReference" VARCHAR(180),
  "checkoutUrl" VARCHAR(2000),
  "expiresAt" TIMESTAMP(3),
  "failureCode" VARCHAR(120),
  "failureMessage" VARCHAR(500),
  "succeededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amountMinor_check" CHECK ("amountMinor" > 0)
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "providerEventId" VARCHAR(200) NOT NULL,
  "eventType" VARCHAR(120) NOT NULL,
  "paymentId" TEXT,
  "payloadHash" CHAR(64) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processingError" VARCHAR(500),
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_provider_providerReference_key" ON "Payment"("provider","providerReference");
CREATE INDEX "Payment_orderId_createdAt_idx" ON "Payment"("orderId","createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status","createdAt");
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider","providerEventId");
CREATE INDEX "PaymentWebhookEvent_paymentId_receivedAt_idx" ON "PaymentWebhookEvent"("paymentId","receivedAt");
CREATE INDEX "PaymentWebhookEvent_processedAt_receivedAt_idx" ON "PaymentWebhookEvent"("processedAt","receivedAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currencyCode_fkey"
  FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
