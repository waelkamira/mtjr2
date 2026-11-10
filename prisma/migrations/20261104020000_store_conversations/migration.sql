CREATE TABLE "StoreConversation" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT,
  "subject" VARCHAR(180) NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerReadAt" TIMESTAMP(3),
  "storeReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreConversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StoreMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" VARCHAR(8000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreConversation_customerId_updatedAt_idx" ON "StoreConversation"("customerId","updatedAt");
CREATE INDEX "StoreConversation_storeId_lastMessageAt_idx" ON "StoreConversation"("storeId","lastMessageAt");
CREATE INDEX "StoreConversation_orderId_idx" ON "StoreConversation"("orderId");
CREATE INDEX "StoreMessage_conversationId_createdAt_idx" ON "StoreMessage"("conversationId","createdAt");
CREATE INDEX "StoreMessage_senderId_createdAt_idx" ON "StoreMessage"("senderId","createdAt");
ALTER TABLE "StoreConversation" ADD CONSTRAINT "StoreConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreConversation" ADD CONSTRAINT "StoreConversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreConversation" ADD CONSTRAINT "StoreConversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreMessage" ADD CONSTRAINT "StoreMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "StoreConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreMessage" ADD CONSTRAINT "StoreMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreConversation" ADD CONSTRAINT "StoreConversation_subject_length_check" CHECK (char_length(btrim("subject")) BETWEEN 5 AND 180);
ALTER TABLE "StoreMessage" ADD CONSTRAINT "StoreMessage_body_length_check" CHECK (char_length(btrim("body")) BETWEEN 2 AND 8000);
