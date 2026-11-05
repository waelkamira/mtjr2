import "server-only";

import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, PermissionDeniedError } from "@/server/identity/permission-guard";
import { normalizeRoleScope, type RoleScope } from "@/server/identity/role-scope";
import { userHasPermission } from "@/server/identity/permission-repository";
import { isProtectedPlatformRole } from "@/server/identity/role-assignment-policy";

export interface AssignRoleInput {
  targetUserId: string;
  roleKey: string;
  scope?: RoleScope;
  expiresAt?: Date | null;
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

  return prisma.$transaction(async (tx) => {
    const [target, role] = await Promise.all([
      tx.user.findUnique({ where: { id: targetUserId }, select: { id: true, status: true } }),
      tx.role.findUnique({ where: { key: roleKey }, select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } } })
    ]);
    if (!target || target.status !== UserStatus.ACTIVE) throw new Error("Role assignments require an active target account.");
    if (!role) throw new Error("The requested role does not exist.");
    if (isProtectedPlatformRole(role.key, role.permissions.map(({ permission }) => permission.key))) {
      throw new PermissionDeniedError();
    }

    // Enforce privilege non-escalation: the actor may delegate only permissions
    // they already hold in this exact scope.
    for (const { permission } of role.permissions) {
      const allowed = await userHasPermission(actor.userId, {
        permissionKey: permission.key,
        scope: scope.type === "GLOBAL" ? undefined : { type: scope.type, id: scope.id },
        now
      });
      if (!allowed) throw new Error("Cannot delegate permissions the acting user does not hold.");
    }

    const assignment = await tx.userRoleAssignment.create({
      data: { userId: target.id, roleId: role.id, scopeType: scope.type, scopeId: scope.id, expiresAt, assignedBy: actor.userId },
      select: { id: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "identity.role_assignment.created", resource: "user_role_assignment",
        resourceId: assignment.id, scopeType: scope.type, scopeId: scope.id, occurredAt: now,
        metadata: { targetUserId: target.id, roleKey: role.key, expiresAt: expiresAt?.toISOString() ?? null }
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
    select: { id: true, scopeType: true, scopeId: true, userId: true, role: { select: { key: true } } }
  });
  if (!existing || existing.userId !== targetUserId) return false;

  // Super Admin access must not be removable through ordinary delegated role
  // management. A future break-glass workflow must have its own safeguards.
  if (existing.role.key === "SUPER_ADMIN") throw new PermissionDeniedError();

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
