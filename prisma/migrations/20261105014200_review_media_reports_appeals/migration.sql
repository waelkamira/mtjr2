CREATE TYPE "ReviewReportReason" AS ENUM (
  'INAPPROPRIATE',
  'SPAM',
  'FAKE',
  'CONFLICT_OF_INTEREST',
  'PERSONAL_INFORMATION',
  'OTHER'
);

CREATE TYPE "ReviewReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTIONED');
CREATE TYPE "ReviewAppealStatus" AS ENUM ('PENDING', 'UPHELD', 'RESTORED');

CREATE TABLE "ReviewMedia" (
  "id" TEXT NOT NULL,
  "productReviewId" TEXT,
  "storeReviewId" TEXT,
  "url" VARCHAR(2048) NOT NULL,
  "altText" VARCHAR(200),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewMedia_exactly_one_review_check"
    CHECK (("productReviewId" IS NOT NULL)::integer + ("storeReviewId" IS NOT NULL)::integer = 1),
  CONSTRAINT "ReviewMedia_position_check" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "ReviewMedia_productReviewId_url_key" ON "ReviewMedia"("productReviewId", "url");
CREATE UNIQUE INDEX "ReviewMedia_storeReviewId_url_key" ON "ReviewMedia"("storeReviewId", "url");
CREATE INDEX "ReviewMedia_productReviewId_position_idx" ON "ReviewMedia"("productReviewId", "position");
CREATE INDEX "ReviewMedia_storeReviewId_position_idx" ON "ReviewMedia"("storeReviewId", "position");

ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_productReviewId_fkey"
  FOREIGN KEY ("productReviewId") REFERENCES "ProductReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_storeReviewId_fkey"
  FOREIGN KEY ("storeReviewId") REFERENCES "StoreReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReviewReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "productReviewId" TEXT,
  "storeReviewId" TEXT,
  "reason" "ReviewReportReason" NOT NULL,
  "details" VARCHAR(1000),
  "status" "ReviewReportStatus" NOT NULL DEFAULT 'PENDING',
  "resolutionNote" VARCHAR(500),
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewReport_exactly_one_review_check"
    CHECK (("productReviewId" IS NOT NULL)::integer + ("storeReviewId" IS NOT NULL)::integer = 1)
);

CREATE UNIQUE INDEX "ReviewReport_reporterId_productReviewId_key" ON "ReviewReport"("reporterId", "productReviewId");
CREATE UNIQUE INDEX "ReviewReport_reporterId_storeReviewId_key" ON "ReviewReport"("reporterId", "storeReviewId");
CREATE INDEX "ReviewReport_status_createdAt_idx" ON "ReviewReport"("status", "createdAt");
CREATE INDEX "ReviewReport_productReviewId_status_idx" ON "ReviewReport"("productReviewId", "status");
CREATE INDEX "ReviewReport_storeReviewId_status_idx" ON "ReviewReport"("storeReviewId", "status");

ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_productReviewId_fkey"
  FOREIGN KEY ("productReviewId") REFERENCES "ProductReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_storeReviewId_fkey"
  FOREIGN KEY ("storeReviewId") REFERENCES "StoreReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReviewAppeal" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "productReviewId" TEXT,
  "storeReviewId" TEXT,
  "reason" VARCHAR(2000) NOT NULL,
  "status" "ReviewAppealStatus" NOT NULL DEFAULT 'PENDING',
  "resolutionNote" VARCHAR(500),
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewAppeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewAppeal_exactly_one_review_check"
    CHECK (("productReviewId" IS NOT NULL)::integer + ("storeReviewId" IS NOT NULL)::integer = 1),
  CONSTRAINT "ReviewAppeal_reason_check" CHECK (length(trim("reason")) >= 20)
);

CREATE UNIQUE INDEX "ReviewAppeal_productReviewId_key" ON "ReviewAppeal"("productReviewId");
CREATE UNIQUE INDEX "ReviewAppeal_storeReviewId_key" ON "ReviewAppeal"("storeReviewId");
CREATE INDEX "ReviewAppeal_status_createdAt_idx" ON "ReviewAppeal"("status", "createdAt");

ALTER TABLE "ReviewAppeal" ADD CONSTRAINT "ReviewAppeal_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewAppeal" ADD CONSTRAINT "ReviewAppeal_resolvedBy_fkey"
  FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewAppeal" ADD CONSTRAINT "ReviewAppeal_productReviewId_fkey"
  FOREIGN KEY ("productReviewId") REFERENCES "ProductReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAppeal" ADD CONSTRAINT "ReviewAppeal_storeReviewId_fkey"
  FOREIGN KEY ("storeReviewId") REFERENCES "StoreReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
