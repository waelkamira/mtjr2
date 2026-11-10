import "server-only";

import { prisma } from "@/lib/db/prisma";
import { requirePlatformSessionStepUp } from "@/server/identity/platform-session-policy";
import {
  hasPermission,
  hasAnyPermission,
  type AuthorizationGrant,
  type AuthorizationRequest
} from "@/server/identity/authorization";

/**
 * Loads effective permission grants for an authenticated user.
 *
 * IMPORTANT: userId must come from a verified server-side session, never from
 * request JSON, query parameters, or client-controlled headers.
 */
export async function getUserAuthorizationGrants(
  userId: string,
  now = new Date()
): Promise<AuthorizationGrant[]> {
  if (!userId.trim()) {
    throw new Error("A verified user ID is required to load authorization grants.");
  }

  const assignments = await prisma.userRoleAssignment.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: {
      scopeType: true,
      scopeId: true,
      expiresAt: true,
      role: {
        select: {
          permissions: {
            select: {
              permission: {
                select: { key: true }
              }
            }
          }
        }
      }
    }
  });

  return assignments.flatMap((assignment) =>
    assignment.role.permissions.map(({ permission }) => ({
      permissionKey: permission.key,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      expiresAt: assignment.expiresAt
    }))
  );
}

async function enforcePlatformStepUp(userId: string, grants: AuthorizationGrant[], now = new Date()) {
  if (grants.some((grant) => grant.permissionKey === "platform:manage" && grant.scopeType === "GLOBAL" && grant.scopeId === "GLOBAL")) {
    await requirePlatformSessionStepUp(userId, now);
  }
}

/**
 * Server-side convenience policy. The caller must resolve userId from the
 * authenticated session before invoking this function.
 */
export async function userHasPermission(
  userId: string,
  request: AuthorizationRequest
): Promise<boolean> {
  const grants = await getUserAuthorizationGrants(userId, request.now);
  await enforcePlatformStepUp(userId, grants, request.now);
  return hasPermission(grants, request);
}

/** Loads grants once and evaluates an any-of permission gate. */
export async function userHasAnyPermission(
  userId: string,
  requests: readonly AuthorizationRequest[],
  now = new Date()
): Promise<boolean> {
  const grants = await getUserAuthorizationGrants(userId, now);
  await enforcePlatformStepUp(userId, grants, now);
  return hasAnyPermission(
    grants,
    requests.map((request) => ({ ...request, now: request.now ?? now }))
  );
}

/**
 * Evaluates only a grant explicitly assigned to the requested resource scope.
 * Unlike userHasPermission, GLOBAL grants are intentionally excluded. Use this
 * when a domain resource must be owned by the actor or delegated explicitly.
 */
export async function userHasScopedPermission(
  userId: string,
  request: AuthorizationRequest & { scope: { type: string; id: string } }
): Promise<boolean> {
  const grants = await getUserAuthorizationGrants(userId, request.now);
  await enforcePlatformStepUp(userId, grants, request.now);
  const exactScopeGrants = grants.filter(
    (grant) => grant.scopeType === request.scope.type && grant.scopeId === request.scope.id
  );
  return hasPermission(exactScopeGrants, request);
}
