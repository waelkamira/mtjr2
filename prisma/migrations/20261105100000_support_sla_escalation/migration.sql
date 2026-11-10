ALTER TABLE "SupportTicket"
  ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
  ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
  ADD COLUMN "firstResponseBreachedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionBreachedAt" TIMESTAMP(3),
  ADD COLUMN "escalatedAt" TIMESTAMP(3);

CREATE TABLE "SupportSlaPolicy" (
  "priority" "SupportTicketPriority" NOT NULL,
  "firstResponseMinutes" INTEGER NOT NULL,
  "resolutionMinutes" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportSlaPolicy_pkey" PRIMARY KEY ("priority"),
  CONSTRAINT "SupportSlaPolicy_firstResponseMinutes_check" CHECK ("firstResponseMinutes" > 0),
  CONSTRAINT "SupportSlaPolicy_resolutionMinutes_check" CHECK ("resolutionMinutes" > 0)
);

INSERT INTO "SupportSlaPolicy" ("priority", "firstResponseMinutes", "resolutionMinutes", "updatedAt")
VALUES
  ('LOW', 1440, 7200, CURRENT_TIMESTAMP),
  ('NORMAL', 480, 4320, CURRENT_TIMESTAMP),
  ('HIGH', 240, 1440, CURRENT_TIMESTAMP),
  ('URGENT', 60, 240, CURRENT_TIMESTAMP);

UPDATE "SupportTicket" AS ticket
SET
  "firstResponseDueAt" = ticket."createdAt" + (policy."firstResponseMinutes" * INTERVAL '1 minute'),
  "resolutionDueAt" = ticket."createdAt" + (policy."resolutionMinutes" * INTERVAL '1 minute')
FROM "SupportSlaPolicy" AS policy
WHERE policy."priority" = ticket."priority";

CREATE INDEX "SupportTicket_firstResponseDueAt_idx" ON "SupportTicket"("status", "firstResponseDueAt");
CREATE INDEX "SupportTicket_resolutionDueAt_idx" ON "SupportTicket"("status", "resolutionDueAt");
CREATE INDEX "SupportTicket_escalatedAt_idx" ON "SupportTicket"("escalatedAt");
