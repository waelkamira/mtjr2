ALTER TABLE "SellerStaff" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Existing invitations receive a seven-day window from their original invitation date.
UPDATE "SellerStaff"
SET "expiresAt" = "invitedAt" + INTERVAL '7 days'
WHERE "status" = 'INVITED';
