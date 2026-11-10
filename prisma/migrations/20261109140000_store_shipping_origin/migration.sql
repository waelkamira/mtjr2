ALTER TABLE "Store"
  ADD COLUMN "shippingContactName" VARCHAR(120),
  ADD COLUMN "shippingPhone" VARCHAR(25),
  ADD COLUMN "shippingAddressLine1" VARCHAR(240),
  ADD COLUMN "shippingAddressLine2" VARCHAR(240),
  ADD COLUMN "shippingCity" VARCHAR(120),
  ADD COLUMN "shippingRegion" VARCHAR(120),
  ADD COLUMN "shippingPostalCode" VARCHAR(40),
  ADD COLUMN "shippingCountryCode" VARCHAR(2),
  ADD COLUMN "shippingInstructions" VARCHAR(1000);
