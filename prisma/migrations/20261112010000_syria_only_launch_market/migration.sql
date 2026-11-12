-- Matjar's current launch scope is Syria only.
-- Preserve historical market, order and pricing records; deactivate non-Syrian
-- markets instead of deleting relational data.
UPDATE "Market"
SET "status" = 'DRAFT',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" <> 'SY-SYR'
  AND "status" = 'ACTIVE';

UPDATE "MarketCurrency" AS mc
SET "isEnabled" = false
FROM "Market" AS m
WHERE mc."marketId" = m."id"
  AND m."code" <> 'SY-SYR'
  AND mc."isEnabled" = true;

-- Ensure the Syrian launch market remains operational.
UPDATE "Market" AS m
SET "status" = 'ACTIVE',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Country" AS c
WHERE m."code" = 'SY-SYR'
  AND m."countryId" = c."id"
  AND c."iso2" = 'SY'
  AND c."isActive" = true;
