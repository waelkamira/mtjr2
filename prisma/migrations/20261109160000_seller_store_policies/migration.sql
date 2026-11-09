ALTER TABLE "Store"
  ADD COLUMN "logoStorageKey" VARCHAR(512),
  ADD COLUMN "bannerStorageKey" VARCHAR(512),
  ADD COLUMN "shippingPolicy" TEXT,
  ADD COLUMN "returnsPolicy" TEXT,
  ADD COLUMN "privacyPolicy" TEXT,
  ADD COLUMN "termsOfSale" TEXT;
