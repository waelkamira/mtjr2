import { createHash, randomBytes } from "node:crypto";
import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/server/identity/normalize-email";
import { hashPassword } from "@/server/identity/password";
import { consumePasswordResetAttempt } from "@/server/identity/login-throttle";
import { createInAppNotification } from "@/server/notifications/notifications";

const RESET_TTL_MS = 60 * 60 * 1000;

function digestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export interface PasswordResetChallenge {
  userId: string;
  /** Deliver only through a trusted server-side email adapter. */
  token: string;
  expiresAt: Date;
}

/**
 * Creates a one-hour, single-use reset challenge for an active verified account.
 * The HTTP layer must always return the same public response whether this
 * function returns a challenge or null, to prevent account enumeration.
 */
export async function createPasswordResetChallenge(
  email: string,
  now = new Date()
): Promise<PasswordResetChallenge | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || normalizedEmail.length > 254) return null;

  const user = await prisma.user.findUnique({
    where: { emailNormalized: normalizedEmail },
    select: { id: true, status: true, emailVerifiedAt: true }
  });

  if (!user || user.status !== UserStatus.ACTIVE || user.emailVerifiedAt === null) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);
  const tokenHash = digestToken(token);

  await prisma.$transaction(async (tx) => {
    // A newly issued challenge invalidates all older outstanding challenges.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now }
    });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt, createdAt: now }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        actorId: user.id,
        action: "identity.password_reset.requested",
        resource: "user",
        resourceId: user.id,
        occurredAt: now
      }
    });
  });

  return { userId: user.id, token, expiresAt };
}


/**
 * Public reset-request entry point. Reuses the established persistent
 * identifier/IP throttle so reset requests cannot bypass login abuse limits.
 * The HTTP handler must always return the same generic response regardless
 * of whether a challenge was created, the account was unknown, or the request
 * was throttled. trustedIpAddress must be resolved by trusted proxy config.
 */
export async function requestPasswordReset(
  email: string,
  trustedIpAddress: string,
  now = new Date()
): Promise<PasswordResetChallenge | null> {
  const throttle = await consumePasswordResetAttempt(
    { identifier: email, trustedIpAddress },
    now
  );
  if (throttle.blocked) return null;
  return createPasswordResetChallenge(email, now);
}

/**
 * Atomically consumes a reset token, changes the password, and revokes every
 * active session. Replays, expired tokens, and inactive accounts fail closed.
 */
export async function completePasswordReset(
  token: string | null | undefined,
  newPassword: string,
  now = new Date()
): Promise<boolean> {
  if (!token || token.length !== 43) return false;

  // Validate/hash before opening the transaction to keep database locks short.
  const passwordHash = await hashPassword(newPassword);
  const tokenHash = digestToken(token);

  return prisma.$transaction(async (tx) => {
    const challenge = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true
      }
    });

    if (
      !challenge ||
      challenge.consumedAt !== null ||
      challenge.expiresAt.getTime() <= now.getTime()
    ) {
      return false;
    }

    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      data: { consumedAt: now }
    });
    if (consumed.count !== 1) return false;

    const changed = await tx.user.updateMany({
      where: { id: challenge.userId, status: UserStatus.ACTIVE },
      data: { passwordHash }
    });
    if (changed.count !== 1) return false;

    await tx.userSession.updateMany({
      where: { userId: challenge.userId, revokedAt: null },
      data: { revokedAt: now }
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: challenge.userId, consumedAt: null },
      data: { consumedAt: now }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        actorId: challenge.userId,
        action: "identity.password_reset.completed",
        resource: "user",
        resourceId: challenge.userId,
        occurredAt: now
      }
    });
    await createInAppNotification(tx, { data: {
      userId: challenge.userId, type: "ACCOUNT_SECURITY",
      title: "Your password was reset",
      message: "Your Mtjr account password was reset successfully. All previous sessions were revoked.",
      resourceType: "ACCOUNT", resourceId: challenge.userId,
      deduplicationKey: `account-security:password-reset:${challenge.userId}:${now.toISOString()}`
    }});

    return true;
  });
}
