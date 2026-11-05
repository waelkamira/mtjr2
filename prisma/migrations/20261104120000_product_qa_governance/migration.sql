CREATE TYPE "ProductQuestionReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

CREATE TABLE "ProductAnswerRevision" (
  "id" TEXT NOT NULL,
  "answerId" TEXT NOT NULL,
  "editorId" TEXT NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductAnswerRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductQuestionReport" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answerId" TEXT,
  "reporterId" TEXT NOT NULL,
  "reason" VARCHAR(32) NOT NULL,
  "details" VARCHAR(1000),
  "status" "ProductQuestionReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductQuestionReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductAnswerRevision_answerId_createdAt_idx" ON "ProductAnswerRevision"("answerId","createdAt");
CREATE INDEX "ProductAnswerRevision_editorId_createdAt_idx" ON "ProductAnswerRevision"("editorId","createdAt");
CREATE UNIQUE INDEX "ProductQuestionReport_questionId_reporterId_key" ON "ProductQuestionReport"("questionId","reporterId");
CREATE INDEX "ProductQuestionReport_status_createdAt_idx" ON "ProductQuestionReport"("status","createdAt");
CREATE INDEX "ProductQuestionReport_answerId_status_idx" ON "ProductQuestionReport"("answerId","status");

ALTER TABLE "ProductAnswerRevision" ADD CONSTRAINT "ProductAnswerRevision_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ProductAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAnswerRevision" ADD CONSTRAINT "ProductAnswerRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductQuestionReport" ADD CONSTRAINT "ProductQuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ProductQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestionReport" ADD CONSTRAINT "ProductQuestionReport_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ProductAnswer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductQuestionReport" ADD CONSTRAINT "ProductQuestionReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestionReport" ADD CONSTRAINT "ProductQuestionReport_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductAnswerRevision" ADD CONSTRAINT "ProductAnswerRevision_body_length_check" CHECK (char_length(btrim("body")) >= 3);
ALTER TABLE "ProductQuestionReport" ADD CONSTRAINT "ProductQuestionReport_reason_check" CHECK ("reason" IN ('SPAM','HARASSMENT','PERSONAL_INFO','MISLEADING','OTHER'));
