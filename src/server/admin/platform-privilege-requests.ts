import "server-only";

import { AuditActorType, Prisma, PlatformPrivilegeRequestStatus, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/server/identity/normalize-email";
import { requirePlatformManagement } from "@/server/identity/permission-guard";
import { isIndependentPrivilegeReviewer } from "@/server/identity/platform-privilege-policy";

const createSchema = z.object({
  email: z.string().trim().email().max(254),
  reason: z.string().trim().min(20).max(1000)
}).strict();

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional()
}).strict();

export class PlatformPrivilegeRequestConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformPrivilegeRequestConflictError";
  }
}

async function lockTarget(tx: Prisma.TransactionClient, targetUserId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${targetUserId}, 0))) AS lock_result`);
  // Serialize with account-status changes as well as other privilege requests.
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${targetUserId} FOR UPDATE`);
}

async function hasActivePlatformGrant(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const assignments = await tx.userRoleAssignment.findMany({
    where: {
      userId,
      scopeType: "GLOBAL",
      scopeId: "GLOBAL",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: {
      role: {
        select: {
          permissions: { select: { permission: { select: { key: true } } } }
        }
      }
    }
  });
  return assignments.some((assignment) =>
    assignment.role.permissions.some(({ permission }) => permission.key === "platform:manage")
  );
}

export async function listPlatformPrivilegeRequests(now = new Date()) {
  await requirePlatformManagement(now);
  const requests = await prisma.platformPrivilegeRequest.findMany({
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      reason: true,
      decisionNote: true,
      requestedAt: true,
      reviewedAt: true,
      targetUser: { select: { id: true, displayName: true, email: true, status: true } },
      requester: { select: { id: true, displayName: true, email: true } },
      reviewer: { select: { id: true, displayName: true, email: true } }
    }
  });
  return requests.map((request) => ({
    ...request,
    requestedAt: request.requestedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null
  }));
}

export async function createPlatformPrivilegeRequest(input: unknown, now = new Date()) {
  const actor = await requirePlatformManagement(now);
  const parsed = createSchema.parse(input);
  const emailNormalized = normalizeEmail(parsed.email);

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { emailNormalized },
      select: { id: true, email: true, displayName: true, status: true }
    });
    if (!target || target.status !== UserStatus.ACTIVE) {
      throw new PlatformPrivilegeRequestConflictError("The target must be an existing active user.");
    }

    await lockTarget(tx, target.id);
    const lockedTarget = await tx.user.findUnique({
      where: { id: target.id },
      select: { id: true, email: true, status: true }
    });
    if (!lockedTarget || lockedTarget.status !== UserStatus.ACTIVE) {
      throw new PlatformPrivilegeRequestConflictError("The target must remain active.");
    }
    if (await hasActivePlatformGrant(tx, lockedTarget.id, now)) {
      throw new PlatformPrivilegeRequestConflictError("The target already has platform-wide management access.");
    }
    const pending = await tx.platformPrivilegeRequest.findFirst({
      where: { targetUserId: lockedTarget.id, status: PlatformPrivilegeRequestStatus.PENDING },
      select: { id: true }
    });
    if (pending) {
      throw new PlatformPrivilegeRequestConflictError("A pending platform privilege request already exists for this user.");
    }

    const request = await tx.platformPrivilegeRequest.create({
      data: {
        targetUserId: lockedTarget.id,
        requestedById: actor.userId,
        reason: parsed.reason
      },
      select: { id: true, status: true, requestedAt: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "platform.privilege_request.created",
        resource: "platform_privilege_request",
        resourceId: request.id,
        scopeType: "GLOBAL",
        scopeId: "GLOBAL",
        occurredAt: now,
        metadata: { targetUserId: lockedTarget.id, targetEmail: lockedTarget.email }
      }
    });
    return { ...request, requestedAt: request.requestedAt.toISOString() };
  });
}

export async function decidePlatformPrivilegeRequest(requestId: string, input: unknown, now = new Date()) {
  const actor = await requirePlatformManagement(now);
  const id = requestId.trim();
  if (!id) throw new PlatformPrivilegeRequestConflictError("A privilege request ID is required.");
  const parsed = decisionSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const initial = await tx.platformPrivilegeRequest.findUnique({
      where: { id },
      select: { id: true, targetUserId: true }
    });
    if (!initial) throw new PlatformPrivilegeRequestConflictError("The platform privilege request was not found.");

    await lockTarget(tx, initial.targetUserId);
    const request = await tx.platformPrivilegeRequest.findUnique({
      where: { id },
      select: {
        id: true,
        targetUserId: true,
        requestedById: true,
        status: true,
        targetUser: { select: { status: true, email: true } }
      }
    });
    if (!request || request.status !== PlatformPrivilegeRequestStatus.PENDING) {
      throw new PlatformPrivilegeRequestConflictError("This request is no longer pending.");
    }
    if (!isIndependentPrivilegeReviewer(request.requestedById, actor.userId)) {
      throw new PlatformPrivilegeRequestConflictError("A requester cannot approve or reject their own privilege request.");
    }

    if (parsed.decision === "APPROVE") {
      if (request.targetUser.status !== UserStatus.ACTIVE) {
        throw new PlatformPrivilegeRequestConflictError("The target account is no longer eligible for platform access.");
      }
      if (await hasActivePlatformGrant(tx, request.targetUserId, now)) {
        throw new PlatformPrivilegeRequestConflictError("The target already has platform-wide management access.");
      }

      const role = await tx.role.findUnique({
        where: { key: "SUPER_ADMIN" },
        select: {
          id: true,
          permissions: { select: { permission: { select: { key: true } } } }
        }
      });
      if (!role || !role.permissions.some(({ permission }) => permission.key === "platform:manage")) {
        throw new PlatformPrivilegeRequestConflictError("The canonical SUPER_ADMIN role is missing its platform:manage permission.");
      }

      const existingAssignment = await tx.userRoleAssignment.findUnique({
        where: {
          userId_roleId_scopeType_scopeId: {
            userId: request.targetUserId,
            roleId: role.id,
            scopeType: "GLOBAL",
            scopeId: "GLOBAL"
          }
        },
        select: { id: true, expiresAt: true }
      });
      if (existingAssignment) {
        await tx.userRoleAssignment.update({
          where: { id: existingAssignment.id },
          data: { expiresAt: null, assignedBy: actor.userId }
        });
      } else {
        await tx.userRoleAssignment.create({
          data: {
            userId: request.targetUserId,
            roleId: role.id,
            scopeType: "GLOBAL",
            scopeId: "GLOBAL",
            assignedBy: actor.userId
          }
        });
      }
    }

    const status = parsed.decision === "APPROVE"
      ? PlatformPrivilegeRequestStatus.APPROVED
      : PlatformPrivilegeRequestStatus.REJECTED;
    const updated = await tx.platformPrivilegeRequest.update({
      where: { id: request.id },
      data: {
        status,
        reviewedById: actor.userId,
        reviewedAt: now,
        decisionNote: parsed.note || null
      },
      select: { id: true, status: true, reviewedAt: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: parsed.decision === "APPROVE"
          ? "platform.privilege_request.approved"
          : "platform.privilege_request.rejected",
        resource: "platform_privilege_request",
        resourceId: request.id,
        scopeType: "GLOBAL",
        scopeId: "GLOBAL",
        occurredAt: now,
        metadata: {
          targetUserId: request.targetUserId,
          requestedById: request.requestedById,
          decisionNote: parsed.note || null
        }
      }
    });
    return { ...updated, reviewedAt: updated.reviewedAt?.toISOString() ?? null };
  });
}
