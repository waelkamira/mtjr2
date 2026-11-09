ALTER TABLE "SellerStaff" ADD COLUMN "roleId" TEXT;

ALTER TABLE "SellerStaff"
ADD CONSTRAINT "SellerStaff_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SellerStaff_roleId_idx" ON "SellerStaff"("roleId");

-- Existing invitations and memberships retain their historical broad role behavior.
UPDATE "SellerStaff" ss
SET "roleId" = r."id"
FROM "Role" r
WHERE r."key" = 'STORE_MANAGER';
