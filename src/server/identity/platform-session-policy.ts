import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AuthenticationRequiredError, getCurrentSession } from "@/server/identity/current-session";

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super("A verified email is required for platform-wide access.");
    this.name = "EmailVerificationRequiredError";
  }
}

export class MfaEnrollmentRequiredError extends Error {
  constructor() {
    super("MFA enrollment is required for platform-wide access.");
    this.name = "MfaEnrollmentRequiredError";
  }
}

export class StepUpRequiredError extends Error {
  constructor() {
    super("Recent MFA verification is required for platform-wide access.");
    this.name = "StepUpRequiredError";
  }
}

/**
 * Every permission evaluation for a platform administrator must pass this
 * gate, even when the requested permission is a normal admin permission.
 * This prevents Super Admin accounts from bypassing MFA through legacy admin
 * pages or services that use userHasPermission directly.
 */
export async function requirePlatformSessionStepUp(userId: string, now = new Date()) {
  const session = await getCurrentSession(now);
  if (!session || session.userId !== userId) throw new AuthenticationRequiredError();
  if (!session.user.emailVerifiedAt) throw new EmailVerificationRequiredError();

  const authenticator = await prisma.userMfaAuthenticator.findUnique({
    where: { userId },
    select: { enabledAt: true }
  });
  if (!authenticator?.enabledAt) throw new MfaEnrollmentRequiredError();

  const verifiedAt = session.stepUpVerifiedAt?.getTime();
  const expiresAt = session.stepUpExpiresAt?.getTime();
  const maxAgeMs = 10 * 60 * 1000;
  if (
    verifiedAt === undefined || expiresAt === undefined ||
    verifiedAt > now.getTime() || now.getTime() - verifiedAt > maxAgeMs ||
    expiresAt <= now.getTime() || expiresAt > verifiedAt + maxAgeMs
  ) {
    throw new StepUpRequiredError();
  }
  return session;
}
