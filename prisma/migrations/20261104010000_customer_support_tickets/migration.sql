CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" VARCHAR(24) NOT NULL,
  "customerId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "subject" VARCHAR(180) NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" VARCHAR(8000) NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_customerId_updatedAt_idx" ON "SupportTicket"("customerId", "updatedAt");
CREATE INDEX "SupportTicket_status_priority_lastMessageAt_idx" ON "SupportTicket"("status", "priority", "lastMessageAt");
CREATE INDEX "SupportTicket_assignedToId_status_lastMessageAt_idx" ON "SupportTicket"("assignedToId", "status", "lastMessageAt");
CREATE INDEX "SupportMessage_ticketId_isInternal_createdAt_idx" ON "SupportMessage"("ticketId", "isInternal", "createdAt");
CREATE INDEX "SupportMessage_senderId_createdAt_idx" ON "SupportMessage"("senderId", "createdAt");

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_subject_length_check"
  CHECK (char_length(btrim("subject")) BETWEEN 5 AND 180);
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_category_check"
  CHECK ("category" IN ('GENERAL', 'ORDER', 'PAYMENT', 'DELIVERY', 'ACCOUNT', 'SELLER'));
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_body_length_check"
  CHECK (char_length(btrim("body")) BETWEEN 2 AND 8000);

ALTER TABLE "SupportTicket" ADD COLUMN "customerReadAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "agentReadAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);
