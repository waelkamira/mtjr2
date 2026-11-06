CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','ACTIVE','PAUSED','ARCHIVED');
CREATE TABLE "AdCampaign" (
"id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "productId" TEXT NOT NULL, "createdById" TEXT NOT NULL, "reviewedById" TEXT,
"title" VARCHAR(140) NOT NULL, "message" VARCHAR(300), "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
"moderationNote" VARCHAR(500), "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
"submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id"),
CONSTRAINT "AdCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "AdCampaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "AdCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "AdCampaign_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
CONSTRAINT "AdCampaign_valid_schedule" CHECK ("startsAt" < "endsAt"));
CREATE INDEX "AdCampaign_storeId_status_createdAt_idx" ON "AdCampaign"("storeId","status","createdAt");
CREATE INDEX "AdCampaign_status_submittedAt_idx" ON "AdCampaign"("status","submittedAt");
CREATE INDEX "AdCampaign_productId_status_idx" ON "AdCampaign"("productId","status");
CREATE INDEX "AdCampaign_startsAt_endsAt_status_idx" ON "AdCampaign"("startsAt","endsAt","status");