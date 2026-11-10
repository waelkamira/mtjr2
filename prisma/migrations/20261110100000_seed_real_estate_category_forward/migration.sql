-- Seed the built-in real-estate category without rewriting an already-applied migration.
-- Safe for databases where the category or its Arabic translation already exists.

INSERT INTO "Category" ("id", "slug", "name", "description", "status", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'builtin-real-estate',
  'real-estate',
  'Real Estate',
  'Properties for sale or rent.',
  'ACTIVE',
  90,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT
  'builtin-real-estate-ar',
  "id",
  'ar',
  'العقارات',
  'عقارات للبيع أو الإيجار.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Category"
WHERE "slug" = 'real-estate'
ON CONFLICT ("categoryId", "locale") DO NOTHING;
