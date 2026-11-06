import "server-only";

import { AuditActorType, SellerStaffStatus, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, PermissionDeniedError } from "@/server/identity/permission-guard";
import { normalizeRoleScope, type RoleScope } from "@/server/identity/role-scope";
import { getUserAuthorizationGrants } from "@/server/identity/permission-repository";
import { getRequiredRoleScopeType, isProtectedPlatformRole } from "@/server/identity/role-assignment-policy";
import { hasPermission } from "@/server/identity/authorization";

export interface AssignRoleInput {
  targetUserId: string;
  roleKey: string;
  scope?: RoleScope;
  expiresAt?: Date | null;
}

export async function listDelegableRoles(now = new Date()) {
  const actor = await requirePermission({ permissionKey: "roles:assign", now });
  const grants = await getUserAuthorizationGrants(actor.userId, now);
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { key: "asc" }],
    select: {
      key: true,
      name: true,
      description: true,
      permissions: { select: { permission: { select: { key: true } } } }
    }
  });
  const delegable: Array<{ key: string; name: string; description: string | null; requiredScopeType: "STORE" | null }> = [];
  for (const role of roles) {
    const permissionKeys = role.permissions.map(({ permission }) => permission.key);
    if (isProtectedPlatformRole(role.key, permissionKeys)) continue;
    const canDelegate = permissionKeys.every((permissionKey) =>
      hasPermission(grants, { permissionKey, now })
    );
    if (canDelegate) delegable.push({
      key: role.key,
      name: role.name,
      description: role.description,
      requiredScopeType: getRequiredRoleScopeType(role.key)
    });
  }
  return delegable;
}

export async function assignRoleToUser(input: AssignRoleInput, now = new Date()): Promise<{ assignmentId: string }> {
  const targetUserId = input.targetUserId.trim();
  const roleKey = input.roleKey.trim().toUpperCase();
  if (!targetUserId || !roleKey) throw new Error("A target user and role are required.");

  const scope = normalizeRoleScope(input.scope);
  const expiresAt = input.expiresAt ?? null;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) throw new Error("Role assignment expiry must be in the future.");

  const actor = await requirePermission({
    permissionKey: "roles:assign",
    scope: scope.type === "GLOBAL" ? undefined : { type: scope.type, id: scope.id },
    now
  });
  const actorGrants = await getUserAuthorizationGrants(actor.userId, now);

  return prisma.$transaction(async (tx) => {
    const [target, role] = await Promise.all([
      tx.user.updateMany({
        where: { id: targetUserId, status: UserStatus.ACTIVE, anonymizedAt: null },
        data: { updatedAt: now }
      }),
      tx.role.findUnique({ where: { key: roleKey }, select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } } })
    ]);
    if (target.count !== 1) throw new Error("Role assignments require an active, non-anonymized target account.");
    if (!role) throw new Error("The requested role does not exist.");
    if (isProtectedPlatformRole(role.key, role.permissions.map(({ permission }) => permission.key))) {
      throw new PermissionDeniedError();
    }
    const requiredScopeType = getRequiredRoleScopeType(role.key);
    if (requiredScopeType && scope.type !== requiredScopeType) {
      throw new Error(`The ${role.key} role requires a ${requiredScopeType} scope.`);
    }
    if (role.key === "STORE_MANAGER") {
      const membership = await tx.sellerStaff.findFirst({
        where: {
          userId: targetUserId,
          storeId: scope.id,
          status: SellerStaffStatus.ACTIVE
        },
        select: { id: true }
      });
      if (!membership) throw new Error("Store manager assignments require an active membership in that store.");
    }

    // Enforce privilege non-escalation: the actor may delegate only permissions
    // they already hold in this exact scope.
    for (const { permission } of role.permissions) {
      if (!hasPermission(actorGrants, {
        permissionKey: permission.key,
        scope: scope.type === "GLOBAL" ? undefined : { type: scope.type, id: scope.id },
        now
      })) throw new Error("Cannot delegate permissions the acting user does not hold.");
    }

    const assignment = await tx.userRoleAssignment.create({
      data: { userId: targetUserId, roleId: role.id, scopeType: scope.type, scopeId: scope.id, expiresAt, assignedBy: actor.userId },
      select: { id: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "identity.role_assignment.created", resource: "user_role_assignment",
        resourceId: assignment.id, scopeType: scope.type, scopeId: scope.id, occurredAt: now,
        metadata: { targetUserId, roleKey: role.key, expiresAt: expiresAt?.toISOString() ?? null }
      }
    });
    return { assignmentId: assignment.id };
  });
}

export async function revokeRoleAssignment(assignmentId: string, targetUserId: string, now = new Date()): Promise<boolean> {
  const id = assignmentId.trim();
  if (!id) throw new Error("A role assignment ID is required.");
  const existing = await prisma.userRoleAssignment.findUnique({
    where: { id },
    select: {
      id: true, scopeType: true, scopeId: true, userId: true,
      role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } }
    }
  });
  if (!existing || existing.userId !== targetUserId) return false;

  // Super Admin access must not be removable through ordinary delegated role
  // management. A future break-glass workflow must have its own safeguards.
  if (isProtectedPlatformRole(existing.role.key, existing.role.permissions.map(({ permission }) => permission.key))) {
    throw new PermissionDeniedError();
  }

  const actor = await requirePermission({
    permissionKey: "roles:assign",
    scope: existing.scopeType === "GLOBAL" && existing.scopeId === "GLOBAL"
      ? undefined : { type: existing.scopeType, id: existing.scopeId },
    now
  });

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.userRoleAssignment.deleteMany({ where: { id: existing.id } });
    if (deleted.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "identity.role_assignment.revoked", resource: "user_role_assignment",
        resourceId: existing.id, scopeType: existing.scopeType, scopeId: existing.scopeId,
        occurredAt: now, metadata: { targetUserId: existing.userId, roleKey: existing.role.key }
      }
    });
    return true;
  });
}
