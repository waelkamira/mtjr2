CREATE TYPE "MessageAttachmentStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'REJECTED');

CREATE TABLE "SupportAttachment" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "messageId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "objectKey" VARCHAR(512) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(120) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "MessageAttachmentStatus" NOT NULL DEFAULT 'PENDING_SCAN',
  "scanError" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scannedAt" TIMESTAMP(3),
  CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportAttachment_objectKey_key" ON "SupportAttachment"("objectKey");
CREATE INDEX "SupportAttachment_ticketId_status_createdAt_idx" ON "SupportAttachment"("ticketId", "status", "createdAt");
CREATE INDEX "SupportAttachment_messageId_idx" ON "SupportAttachment"("messageId");
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoreMessageAttachment" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "objectKey" VARCHAR(512) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(120) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "MessageAttachmentStatus" NOT NULL DEFAULT 'PENDING_SCAN',
  "scanError" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scannedAt" TIMESTAMP(3),
  CONSTRAINT "StoreMessageAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreMessageAttachment_objectKey_key" ON "StoreMessageAttachment"("objectKey");
CREATE INDEX "StoreMessageAttachment_conversationId_status_createdAt_idx" ON "StoreMessageAttachment"("conversationId", "status", "createdAt");
CREATE INDEX "StoreMessageAttachment_messageId_idx" ON "StoreMessageAttachment"("messageId");
ALTER TABLE "StoreMessageAttachment" ADD CONSTRAINT "StoreMessageAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StoreConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreMessageAttachment" ADD CONSTRAINT "StoreMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "StoreMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreMessageAttachment" ADD CONSTRAINT "StoreMessageAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
