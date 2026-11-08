CREATE TABLE "SyriaNeighborhood" (
  "id" TEXT NOT NULL,
  "governorateId" TEXT NOT NULL,
  "cityGroupNameAr" VARCHAR(120) NOT NULL,
  "nameAr" VARCHAR(160) NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "sourceCommit" VARCHAR(64) NOT NULL,
  "verificationStatus" VARCHAR(24) NOT NULL DEFAULT 'CANDIDATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyriaNeighborhood_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyriaNeighborhood_governorateId_verificationStatus_cityGroupNameAr_idx" ON "SyriaNeighborhood"("governorateId", "verificationStatus", "cityGroupNameAr");
CREATE INDEX "SyriaNeighborhood_governorateId_nameAr_idx" ON "SyriaNeighborhood"("governorateId", "nameAr");
ALTER TABLE "SyriaNeighborhood" ADD CONSTRAINT "SyriaNeighborhood_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "SyriaGovernorate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
