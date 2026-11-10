CREATE TYPE "PaymentProviderEnvironment" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "PaymentProviderConfigStatus" AS ENUM ('DRAFT', 'CONFIGURED', 'ACTIVE', 'DISABLED', 'ARCHIVED');

CREATE TABLE "PaymentProviderConfig" (
  "id" TEXT NOT NULL,
  "providerKey" VARCHAR(64) NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "environment" "PaymentProviderEnvironment" NOT NULL,
  "status" "PaymentProviderConfigStatus" NOT NULL DEFAULT 'DRAFT',
  "encryptedCredentials" TEXT,
  "credentialsKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "credentialFingerprint" VARCHAR(24),
  "supportedCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "supportedCurrencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabledPaymentMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastVerificationStatus" VARCHAR(32),
  "lastVerificationMessage" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentProviderConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentProviderConfig_sortOrder_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "PaymentProviderConfig_credentialsKeyVersion_check" CHECK ("credentialsKeyVersion" > 0)
);

CREATE UNIQUE INDEX "PaymentProviderConfig_providerKey_environment_key"
  ON "PaymentProviderConfig"("providerKey", "environment");
CREATE INDEX "PaymentProviderConfig_status_sortOrder_idx"
  ON "PaymentProviderConfig"("status", "sortOrder");
CREATE INDEX "PaymentProviderConfig_environment_status_idx"
  ON "PaymentProviderConfig"("environment", "status");
