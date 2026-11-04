import "server-only";

import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/server/identity/password";

export type PasswordChangeResult =
  | "UPDATED"
  | "INVALID_CURRENT_PASSWORD"
  | "PASSWORD_NOT_SET"
  | "PASSWORD_UNCHANGED"
  | "CONCURRENT_CHANGE";

export async function changePassword(
  input: {
    userId: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
  },
  now = new Date()
): Promise<PasswordChangeResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true, status: true, emailVerifiedAt: true }
  });
  if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
    return "CONCURRENT_CHANGE";
  }
  if (!user.passwordHash) return "PASSWORD_NOT_SET";
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return "INVALID_CURRENT_PASSWORD";
  }
  if (input.currentPassword === input.newPassword) return "PASSWORD_UNCHANGED";

  const passwordHash = await hashPassword(input.newPassword);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: input.userId,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: { not: null },
        passwordHash: user.passwordHash
      },
      data: { passwordHash }
    });
    if (updated.count !== 1) return "CONCURRENT_CHANGE";

    await tx.userSession.updateMany({
      where: {
        userId: input.userId,
        id: { not: input.currentSessionId },
        revokedAt: null
      },
      data: { revokedAt: now }
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: input.userId, consumedAt: null },
      data: { consumedAt: now }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: input.userId,
        action: "identity.password.changed",
        resource: "user",
        resourceId: input.userId,
        occurredAt: now
      }
    });
    return "UPDATED";
  });
}
