import { GLOBAL_SCOPE } from "@/server/identity/authorization";

export interface RoleScope {
  type: string;
  id: string;
}

/**
 * Canonicalizes an assignment scope. Omitted scope means a global assignment.
 * GLOBAL is reserved and cannot be used as a real scoped resource identifier.
 */
export function normalizeRoleScope(scope?: RoleScope): RoleScope {
  if (scope === undefined) return GLOBAL_SCOPE;

  const type = scope.type.trim().toUpperCase();
  const id = scope.id.trim();

  if (!type || !id) {
    throw new Error("Scoped role assignments require both a scope type and scope ID.");
  }

  if (type === GLOBAL_SCOPE.type || id === GLOBAL_SCOPE.id) {
    throw new Error("GLOBAL is reserved for unscoped role assignments.");
  }

  return { type, id };
}
