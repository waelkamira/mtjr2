ALTER TABLE "UserSession"
  ADD COLUMN "stepUpVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "stepUpExpiresAt" TIMESTAMP(3);
