CREATE TYPE "ReturnItemStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'CANCELLED');

ALTER TABLE "ReturnItem"
  ADD COLUMN "status" "ReturnItemStatus" NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN "reviewNote" VARCHAR(1000),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "ReturnItem_status_reviewedAt_idx" ON "ReturnItem"("status", "reviewedAt");
