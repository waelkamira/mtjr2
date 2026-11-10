-- Establish Syria as the primary launch market with SYP as its base
-- currency and USD available as an explicitly enabled secondary currency.
INSERT INTO "Country" ("id", "iso2", "iso3", "name", "nativeName", "phoneCallingCode", "isActive", "createdAt", "updatedAt")
VALUES ('country-syria', 'SY', 'SYR', 'Syria', 'سوريا', '+963', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("iso2") DO UPDATE SET
  "iso3" = EXCLUDED."iso3",
  "name" = EXCLUDED."name",
  "nativeName" = EXCLUDED."nativeName",
  "phoneCallingCode" = EXCLUDED."phoneCallingCode",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Currency" ("code", "name", "symbol", "minorUnit", "isActive", "createdAt", "updatedAt")
VALUES
  ('SYP', 'Syrian Pound', 'ل.س', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('USD', 'US Dollar', '$', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "symbol" = EXCLUDED."symbol",
  "minorUnit" = EXCLUDED."minorUnit",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Market" ("id", "code", "name", "countryId", "defaultCurrencyCode", "status", "createdAt", "updatedAt")
SELECT 'market-syria', 'SY-SYR', 'Syria', c."id", 'SYP', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Country" c WHERE c."iso2" = 'SY'
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "countryId" = EXCLUDED."countryId",
  "defaultCurrencyCode" = 'SYP',
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "MarketCurrency" ("marketId", "currencyCode", "isEnabled", "createdAt")
SELECT m."id", currency_code, true, CURRENT_TIMESTAMP
FROM "Market" m
CROSS JOIN (VALUES ('SYP'::char(3)), ('USD'::char(3))) AS currencies(currency_code)
WHERE m."code" = 'SY-SYR'
ON CONFLICT ("marketId", "currencyCode") DO UPDATE SET "isEnabled" = true;
