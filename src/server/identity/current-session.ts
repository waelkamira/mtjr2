import "server-only";

import { getSessionCookie } from "@/server/identity/session-cookie";
import {
  resolveUserSession,
  type AuthenticatedSession
} from "@/server/identity/session";

/** Returned when a server-rendered page or handler requires authentication. */
export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

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
  return session;
}
