CREATE TABLE "Recommendation" (
  "id" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "recommendedProductId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "reason" VARCHAR(120),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Recommendation_sourceProductId_recommendedProductId_key"
  ON "Recommendation"("sourceProductId", "recommendedProductId");
CREATE INDEX "Recommendation_sourceProductId_isActive_score_idx"
  ON "Recommendation"("sourceProductId", "isActive", "score");
CREATE INDEX "Recommendation_recommendedProductId_isActive_idx"
  ON "Recommendation"("recommendedProductId", "isActive");

ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_sourceProductId_fkey"
  FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_recommendedProductId_fkey"
  FOREIGN KEY ("recommendedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
