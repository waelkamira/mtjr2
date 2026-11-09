ALTER TABLE "Payment"
  ADD COLUMN "providerConfigId" TEXT,
  ADD COLUMN "providerEnvironment" "PaymentProviderEnvironment",
  ADD COLUMN "encryptedProviderCredentials" TEXT,
  ADD COLUMN "providerCredentialsKeyVersion" INTEGER;

CREATE INDEX "Payment_providerConfigId_createdAt_idx"
  ON "Payment"("providerConfigId", "createdAt");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_providerConfigId_fkey"
  FOREIGN KEY ("providerConfigId") REFERENCES "PaymentProviderConfig"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
