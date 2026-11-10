CREATE TYPE "PlatformPrivilegeRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "PlatformPrivilegeRequest" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "status" "PlatformPrivilegeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" VARCHAR(1000) NOT NULL,
  "decisionNote" VARCHAR(1000),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformPrivilegeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformPrivilegeRequest_reason_check" CHECK (length(trim("reason")) >= 20)
);

CREATE INDEX "PlatformPrivilegeRequest_status_requestedAt_idx"
  ON "PlatformPrivilegeRequest"("status", "requestedAt");
CREATE INDEX "PlatformPrivilegeRequest_targetUserId_status_idx"
  ON "PlatformPrivilegeRequest"("targetUserId", "status");
CREATE INDEX "PlatformPrivilegeRequest_requestedById_requestedAt_idx"
  ON "PlatformPrivilegeRequest"("requestedById", "requestedAt");
CREATE INDEX "PlatformPrivilegeRequest_reviewedById_reviewedAt_idx"
  ON "PlatformPrivilegeRequest"("reviewedById", "reviewedAt");

ALTER TABLE "PlatformPrivilegeRequest"
  ADD CONSTRAINT "PlatformPrivilegeRequest_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformPrivilegeRequest"
  ADD CONSTRAINT "PlatformPrivilegeRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformPrivilegeRequest"
  ADD CONSTRAINT "PlatformPrivilegeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
