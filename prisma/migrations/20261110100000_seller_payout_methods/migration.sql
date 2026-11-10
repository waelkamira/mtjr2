CREATE TYPE "SellerPayoutMethodType" AS ENUM ('IBAN', 'LOCAL_BANK_ACCOUNT');
CREATE TYPE "SellerPayoutMethodStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'DISABLED');

CREATE TABLE "SellerPayoutMethod" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "type" "SellerPayoutMethodType" NOT NULL,
  "accountHolderName" VARCHAR(160) NOT NULL,
  "bankName" VARCHAR(160) NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "encryptedDetails" TEXT NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL,
  "accountLast4" VARCHAR(4) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "status" "SellerPayoutMethodStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerPayoutMethod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerPayoutMethod_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerPayoutMethod_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SellerPayoutMethod_sellerId_fingerprint_key" ON "SellerPayoutMethod"("sellerId", "fingerprint");
CREATE INDEX "SellerPayoutMethod_sellerId_status_isDefault_idx" ON "SellerPayoutMethod"("sellerId", "status", "isDefault");
