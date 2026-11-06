ALTER TABLE "UserSession"
ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

CREATE TABLE "UserTwoFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3),
    "lastVerifiedStep" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserTwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "UserTwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTwoFactor_userId_key" ON "UserTwoFactor"("userId");
CREATE INDEX "UserTwoFactor_enabledAt_idx" ON "UserTwoFactor"("enabledAt");
CREATE UNIQUE INDEX "UserTwoFactorRecoveryCode_codeHash_key" ON "UserTwoFactorRecoveryCode"("codeHash");
CREATE INDEX "UserTwoFactorRecoveryCode_userId_usedAt_idx" ON "UserTwoFactorRecoveryCode"("userId", "usedAt");

ALTER TABLE "UserTwoFactor"
ADD CONSTRAINT "UserTwoFactor_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTwoFactorRecoveryCode"
ADD CONSTRAINT "UserTwoFactorRecoveryCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserTwoFactor"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
