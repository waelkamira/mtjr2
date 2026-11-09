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

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_provider_credentials_snapshot_consistency_check"
  CHECK (
    ("providerConfigId" IS NULL AND "providerEnvironment" IS NULL
      AND "encryptedProviderCredentials" IS NULL AND "providerCredentialsKeyVersion" IS NULL)
    OR
    ("providerConfigId" IS NOT NULL AND "providerEnvironment" IS NOT NULL
      AND "encryptedProviderCredentials" IS NOT NULL AND "providerCredentialsKeyVersion" IS NOT NULL)
  );
