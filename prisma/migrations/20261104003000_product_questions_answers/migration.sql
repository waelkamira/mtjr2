CREATE TYPE "ProductQuestionStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');
CREATE TYPE "ProductAnswerStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');

CREATE TABLE "ProductQuestion" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "question" VARCHAR(2000) NOT NULL,
  "status" "ProductQuestionStatus" NOT NULL DEFAULT 'PENDING',
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductAnswer" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "status" "ProductAnswerStatus" NOT NULL DEFAULT 'PENDING',
  "moderatedAt" TIMESTAMP(3),
  "moderatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductQuestion_productId_status_createdAt_idx" ON "ProductQuestion"("productId","status","createdAt");
CREATE INDEX "ProductQuestion_userId_createdAt_idx" ON "ProductQuestion"("userId","createdAt");
CREATE INDEX "ProductQuestion_status_createdAt_idx" ON "ProductQuestion"("status","createdAt");
CREATE INDEX "ProductAnswer_questionId_status_createdAt_idx" ON "ProductAnswer"("questionId","status","createdAt");
CREATE INDEX "ProductAnswer_userId_createdAt_idx" ON "ProductAnswer"("userId","createdAt");
CREATE INDEX "ProductAnswer_status_createdAt_idx" ON "ProductAnswer"("status","createdAt");

ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ProductQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_question_length_check"
  CHECK (char_length(btrim("question")) >= 10);
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_body_length_check"
  CHECK (char_length(btrim("body")) >= 3);
