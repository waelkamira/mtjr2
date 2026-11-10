export const GLOBAL_SCOPE = {
  type: "GLOBAL",
  id: "GLOBAL"
} as const;

export interface AuthorizationGrant {
  permissionKey: string;
  scopeType: string;
  scopeId: string;
  expiresAt: Date | null;
}

export interface AuthorizationRequest {
  permissionKey: string;
  scope?: {
    type: string;
    id: string;
  };
  now?: Date;
}

/**
 * Evaluates already-resolved permission grants.
 * Global grants apply everywhere; scoped grants apply only to the exact scope.
 * Missing scope data and expired grants fail closed.
 *
 * This is a pure policy function. A trusted server-side repository must load
 * grants for the authenticated user; callers must never pass browser-supplied
 * roles or grants into this function.
 */
export function hasPermission(
  grants: readonly AuthorizationGrant[],
  request: AuthorizationRequest
): boolean {
  const now = request.now ?? new Date();

  return grants.some((grant) => {
    if (grant.permissionKey !== request.permissionKey) return false;
    if (grant.expiresAt !== null && grant.expiresAt.getTime() <= now.getTime()) {
      return false;
    }

    const isGlobal =
      grant.scopeType === GLOBAL_SCOPE.type &&
      grant.scopeId === GLOBAL_SCOPE.id;

    if (isGlobal) return true;

    return (
      request.scope !== undefined &&
      grant.scopeType === request.scope.type &&
      grant.scopeId === request.scope.id
    );
  });
}

/** Returns true when at least one requested permission is held in scope. */
export function hasAnyPermission(
  grants: readonly AuthorizationGrant[],
  requests: readonly AuthorizationRequest[]
): boolean {
  return requests.some((request) => hasPermission(grants, request));
}
