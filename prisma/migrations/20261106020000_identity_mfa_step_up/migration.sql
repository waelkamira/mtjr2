ALTER TABLE "UserSession"
  ADD COLUMN "stepUpVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "stepUpExpiresAt" TIMESTAMP(3);

CREATE TABLE "UserMfaAuthenticator" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secretCiphertext" VARCHAR(256) NOT NULL,
  "secretIv" VARCHAR(32) NOT NULL,
  "secretTag" VARCHAR(32) NOT NULL,
  "enabledAt" TIMESTAMP(3),
  "lastUsedStep" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMfaAuthenticator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserMfaAuthenticator_userId_key" ON "UserMfaAuthenticator"("userId");
CREATE INDEX "UserMfaAuthenticator_enabledAt_idx" ON "UserMfaAuthenticator"("enabledAt");
ALTER TABLE "UserMfaAuthenticator" ADD CONSTRAINT "UserMfaAuthenticator_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MfaRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" CHAR(64) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaRecoveryCode_userId_codeHash_key" ON "MfaRecoveryCode"("userId", "codeHash");
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
