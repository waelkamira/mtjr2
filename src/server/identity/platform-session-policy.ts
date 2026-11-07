import "server-only";

import { getMfaAccessState } from "@/server/identity/mfa";
import { getCurrentSession } from "@/server/identity/current-session";
import {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError,
  StepUpRequiredError
} from "@/server/identity/access-errors";

/** Every platform administrator permission check requires a fresh ten-minute TOTP step-up. */
export async function requirePlatformSessionStepUp(userId: string, now = new Date()) {
  const session = await getCurrentSession(now);
  if (!session || session.userId !== userId) throw new AuthenticationRequiredError();

  const mfa = await getMfaAccessState(userId, now);
  if (!mfa.enabled) throw new MfaEnrollmentRequiredError();

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
