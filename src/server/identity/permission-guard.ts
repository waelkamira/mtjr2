import "server-only";

import {
  AuthenticationRequiredError,
  requireCurrentSession
} from "@/server/identity/current-session";
import {
  userHasPermission,
  userHasAnyPermission
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

/** Require at least one permission for a server-rendered admin shell. */
export async function requireAnyPermission(
  requests: readonly AuthorizationRequest[],
  now = new Date()
) {
  if (requests.length === 0) throw new PermissionDeniedError();

  const session = await requireCurrentSession(now);
  const allowed = await userHasAnyPermission(session.userId, requests, now);

  if (!allowed) throw new PermissionDeniedError();
  return session;
}

/** Dedicated gate for platform-wide Super Admin surfaces and mutations. */
export async function requirePlatformManagement(now = new Date()) {
  return requirePermission({ permissionKey: "platform:manage", now }, now);
}

export { AuthenticationRequiredError };
