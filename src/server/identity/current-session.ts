import "server-only";

import { getSessionCookie } from "@/server/identity/session-cookie";
import {
  resolveUserSession,
  type AuthenticatedSession
} from "@/server/identity/session";
import {
  getMfaAccessState,
  isMfaVerificationFresh
} from "@/server/identity/mfa";
import {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError
} from "@/server/identity/access-errors";

export {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError
} from "@/server/identity/access-errors";

/**
 * Resolves the current request's HttpOnly cookie against PostgreSQL.
 * Never accepts a user ID or bearer token from client-controlled parameters.
 */
export async function getCurrentSession(
  now = new Date()
): Promise<AuthenticatedSession | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return resolveUserSession(token, now);
}

/** Use at the server boundary before loading any user-owned resource. */
export async function requireCurrentSession(
  now = new Date()
): Promise<AuthenticatedSession> {
  const session = await getCurrentSession(now);
  if (!session) throw new AuthenticationRequiredError();
  const mfa = await getMfaAccessState(session.userId, now);
  if (mfa.enrollmentRequired) throw new MfaEnrollmentRequiredError();
  if (mfa.required && !isMfaVerificationFresh(session.mfaVerifiedAt, now)) {
    throw new MfaVerificationRequiredError();
  }
  return session;
}

export { PermissionDeniedError } from "@/server/identity/access-errors";
