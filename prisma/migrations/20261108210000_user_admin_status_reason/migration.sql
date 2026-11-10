ALTER TABLE "User"
ADD COLUMN "adminStatusReason" TEXT;

-- Preserve administrative holds that were already applied before this marker
-- existed. Only the latest recorded administrative transition determines
-- whether a currently pending account is an administrative hold.
UPDATE "User" AS u
SET "adminStatusReason" = COALESCE((
  SELECT al."metadata" ->> 'reason'
  FROM "AuditLog" AS al
  WHERE al."resource" = 'user'
    AND al."resourceId" = u."id"
    AND al."action" = 'identity.user.status_changed'
  ORDER BY al."occurredAt" DESC, al."id" DESC
  LIMIT 1
), 'Administrative account hold')
WHERE u."status" = 'PENDING'
  AND (
    SELECT al."metadata" ->> 'status'
    FROM "AuditLog" AS al
    WHERE al."resource" = 'user'
      AND al."resourceId" = u."id"
      AND al."action" = 'identity.user.status_changed'
    ORDER BY al."occurredAt" DESC, al."id" DESC
    LIMIT 1
  ) = 'PENDING';
