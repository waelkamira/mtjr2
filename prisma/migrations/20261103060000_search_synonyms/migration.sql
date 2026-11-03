CREATE TABLE "SearchSynonym" (
  "id" TEXT NOT NULL,
  "locale" VARCHAR(16) NOT NULL,
  "term" VARCHAR(160) NOT NULL,
  "synonym" VARCHAR(160) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchSynonym_locale_term_synonym_key"
  ON "SearchSynonym"("locale", "term", "synonym");
CREATE INDEX "SearchSynonym_locale_term_isActive_idx"
  ON "SearchSynonym"("locale", "term", "isActive");
