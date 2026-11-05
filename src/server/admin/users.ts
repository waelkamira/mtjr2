import "server-only";

import { AuditActorType, Prisma, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

const idSchema = z.string().trim().min(1).max(128);
const statusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().trim().min(5).max(500)
}).strict();

const listSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { orders: true, sessions: true, roleAssignments: true } }
} satisfies Prisma.UserSelect;

export async function listAdminUsers(input: unknown, now = new Date()) {
  const filters = listSchema.parse(input);
  await requirePermission({ permissionKey: "users:manage", now });
  const q = filters.q || undefined;
  const where: Prisma.UserWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(q ? {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { id: q }
      ]
    } : {})
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: listSelect
    })
  ]);
  return {
    items: users.map(({ _count, ...user }) => ({
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      orderCount: _count.orders,
      sessionCount: _count.sessions,
      roleCount: _count.roleAssignments
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit)
  };
}

export async function getAdminUser(userId: string, now = new Date()) {
  const id = idSchema.parse(userId);
  await requirePermission({ permissionKey: "users:manage", now });
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      roleAssignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true,
          scopeType: true,
          scopeId: true,
          assignedAt: true,
          expiresAt: true,
          role: { select: { key: true, name: true } }
        }
      },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        take: 50,
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true }
      },
      consents: {
        orderBy: { capturedAt: "desc" },
        take: 50,
        select: { id: true, type: true, version: true, granted: true, source: true, capturedAt: true }
      },
      loginAttempts: {
        orderBy: { attemptedAt: "desc" },
        take: 50,
        select: { id: true, succeeded: true, attemptedAt: true }
      },
      auditEvents: {
        where: { resource: "user", resourceId: id },
        orderBy: { occurredAt: "desc" },
        take: 50,
        select: { id: true, action: true, actorId: true, occurredAt: true }
      },
      _count: { select: { orders: true, sessions: true, loginAttempts: true, consents: true } }
    }
  });
  if (!user) throw new Error("User was not found.");
  return {
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roleAssignments: user.roleAssignments.map((assignment) => ({
      ...assignment,
      assignedAt: assignment.assignedAt.toISOString(),
      expiresAt: assignment.expiresAt?.toISOString() ?? null
    })),
    sessions: user.sessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null
    })),
    consents: user.consents.map((consent) => ({ ...consent, capturedAt: consent.capturedAt.toISOString() })),
    loginAttempts: user.loginAttempts.map((attempt) => ({ ...attempt, attemptedAt: attempt.attemptedAt.toISOString() })),
    auditEvents: user.auditEvents.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
    counts: {
      orders: user._count.orders,
      sessions: user._count.sessions,
      loginAttempts: user._count.loginAttempts,
      consents: user._count.consents
    }
  };
}

export async function changeAdminUserStatus(userId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(userId);
  const data = statusSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  if (actor.userId === id) throw new Error("Administrators cannot change their own account status.");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        roleAssignments: { where: { role: { key: "SUPER_ADMIN" } }, select: { id: true } }
      }
    });
    if (!target) throw new Error("User was not found.");
    if (target.roleAssignments.length) throw new Error("Super administrator accounts cannot be changed through user administration.");
    if (target.status === data.status) throw new Error("The account already has that status.");

    const changed = await tx.user.updateMany({
      where: { id, status: target.status },
      data: { status: data.status }
    });
    if (changed.count !== 1) throw new Error("The account changed concurrently. Reload and retry.");

    let revokedSessions = 0;
    if (data.status === UserStatus.SUSPENDED || data.status === UserStatus.DISABLED) {
      const revoked = await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now }
      });
      revokedSessions = revoked.count;
    }
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "identity.user.status_changed",
        resource: "user",
        resourceId: id,
        occurredAt: now,
        metadata: {
          previousStatus: target.status,
          status: data.status,
          reason: data.reason,
          revokedSessions
        }
      }
    });
    return { userId: id, previousStatus: target.status, status: data.status, revokedSessions };
  });
}
