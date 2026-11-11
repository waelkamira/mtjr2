ALTER TABLE "Seller"
  ADD COLUMN "registrationCountryCode" CHAR(2),
  ADD COLUMN "registrationNumber" VARCHAR(120),
  ADD COLUMN "registrationAuthority" VARCHAR(160),
  ADD COLUMN "registrationDate" TIMESTAMP(3),
  ADD COLUMN "registeredAddress" VARCHAR(500),
  ADD COLUMN "taxIdentificationNumber" VARCHAR(120),
  ADD COLUMN "businessWebsite" VARCHAR(2048),
  ADD COLUMN "businessRegistrationDocumentFileId" TEXT,
  ADD COLUMN "taxCertificateDocumentFileId" TEXT,
  ADD COLUMN "proofOfAddressDocumentFileId" TEXT;

ALTER TABLE "Seller"
  ADD CONSTRAINT "Seller_registrationCountryCode_format_check"
  CHECK ("registrationCountryCode" IS NULL OR "registrationCountryCode" ~ '^[A-Z]{2}$');
