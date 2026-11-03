import "server-only";

import {
  AuthenticationRequiredError,
  requireCurrentSession
} from "@/server/identity/current-session";
import {
  userHasPermission
} from "@/server/identity/permission-repository";
import type { AuthorizationRequest } from "@/server/identity/authorization";

export class PermissionDeniedError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "PermissionDeniedError";
  }
}

/**
 * Requires an authenticated request and evaluates its permissions using only
 * the user ID obtained from the verified HttpOnly-cookie-backed session.
 * Resource scope must be resolved by trusted server code, never copied from
 * an unvalidated client claim.
 */
export async function requirePermission(
  request: AuthorizationRequest,
  now = request.now ?? new Date()
) {
  const session = await requireCurrentSession(now);
  const allowed = await userHasPermission(session.userId, {
    ...request,
    now
  });

  if (!allowed) throw new PermissionDeniedError();
  return session;
}

export { AuthenticationRequiredError };
