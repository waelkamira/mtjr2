-- Keep existing seller catalog purchasable after the launch market was narrowed to Syria.
-- Store links are migrated without deleting historical market links.
INSERT INTO "StoreMarket" ("storeId", "marketId", "isEnabled", "createdAt")
SELECT DISTINCT sm."storeId", sy."id", true, CURRENT_TIMESTAMP
FROM "StoreMarket" sm
JOIN "Market" old_market ON old_market."id" = sm."marketId"
JOIN "Market" sy ON sy."code" = 'SY-SYR' AND sy."status" = 'ACTIVE'
WHERE old_market."code" <> 'SY-SYR'
  AND sm."isEnabled" = true
ON CONFLICT ("storeId", "marketId")
DO UPDATE SET "isEnabled" = true;

-- Copy prices into Syria only when all enabled legacy-market prices for the same
-- variant/currency agree. Currency values are never converted or guessed.
-- Conflicting legacy prices are deliberately left for seller review.
WITH eligible AS (
  SELECT
    pv."id" AS "variantId",
    sy."id" AS "marketId",
    pp."currencyCode",
    MIN(pp."amountMinor") AS "amountMinor",
    MIN(pp."compareAtMinor") AS "compareAtMinor"
  FROM "ProductVariant" pv
  JOIN "Product" p ON p."id" = pv."productId"
  JOIN "StoreMarket" sm ON sm."storeId" = p."storeId" AND sm."isEnabled" = true
  JOIN "Market" old_market ON old_market."id" = sm."marketId" AND old_market."code" <> 'SY-SYR'
  JOIN "ProductPrice" pp ON pp."variantId" = pv."id" AND pp."marketId" = old_market."id"
  JOIN "Market" sy ON sy."code" = 'SY-SYR' AND sy."status" = 'ACTIVE'
  JOIN "MarketCurrency" sy_currency
    ON sy_currency."marketId" = sy."id"
   AND sy_currency."currencyCode" = pp."currencyCode"
   AND sy_currency."isEnabled" = true
  JOIN "Currency" currency
    ON currency."code" = pp."currencyCode" AND currency."isActive" = true
  WHERE pv."isActive" = true
  GROUP BY pv."id", sy."id", pp."currencyCode"
  HAVING COUNT(DISTINCT (pp."amountMinor", pp."compareAtMinor")) = 1
)
INSERT INTO "ProductPrice" ("id", "variantId", "marketId", "currencyCode", "amountMinor", "compareAtMinor", "createdAt", "updatedAt")
SELECT
  'sy_' || md5(eligible."variantId" || ':' || eligible."marketId" || ':' || eligible."currencyCode"),
  eligible."variantId",
  eligible."marketId",
  eligible."currencyCode",
  eligible."amountMinor",
  eligible."compareAtMinor",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM eligible
ON CONFLICT ("variantId", "marketId", "currencyCode") DO NOTHING;
