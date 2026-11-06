import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma, ReviewStatus, SellerStatus, StoreStatus, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requirePlatformManagement } from "@/server/identity/permission-guard";
import { isProtectedPlatformRole } from "@/server/identity/role-assignment-policy";
import { getUserAuthorizationGrants } from "@/server/identity/permission-repository";
import { hasPermission } from "@/server/identity/authorization";
import { getMfaAccessState } from "@/server/identity/mfa";

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
  anonymizedAt: true,
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
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  const [user, grants] = await Promise.all([
    prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      anonymizedAt: true,
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
          role: {
            select: {
              key: true,
              name: true,
              permissions: { select: { permission: { select: { key: true } } } }
            }
          }
        }
      },
      storeMemberships: {
        where: { status: "ACTIVE" },
        select: {
          store: { select: { id: true, name: true, status: true } }
        }
      },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        take: 50,
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true }
      },
      twoFactor: { select: { enabledAt: true } },
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
    }),
    getUserAuthorizationGrants(actor.userId, now)
  ]);
  if (!user) throw new Error("User was not found.");
  const mfaAccess = await getMfaAccessState(user.id, now);
  const canManageRoles = hasPermission(grants, { permissionKey: "roles:assign", now });
  const canAnonymize = hasPermission(grants, { permissionKey: "platform:manage", now });
  return {
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    anonymizedAt: user.anonymizedAt?.toISOString() ?? null,
    twoFactor: { enabledAt: user.twoFactor?.enabledAt?.toISOString() ?? null },
    permissions: { canManageRoles, canAnonymize, mfaRequired: !user.anonymizedAt && mfaAccess.required },
    roleAssignments: user.roleAssignments.map((assignment) => ({
      ...assignment,
      assignedAt: assignment.assignedAt.toISOString(),
      expiresAt: assignment.expiresAt?.toISOString() ?? null
    })),
    roleAssignableStores: user.storeMemberships.map(({ store }) => store),
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
        anonymizedAt: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                key: true,
                permissions: { select: { permission: { select: { key: true } } } }
              }
            }
          }
        }
      }
    });
    if (!target) throw new Error("User was not found.");
    if (target.anonymizedAt) throw new Error("Anonymized accounts cannot be changed.");
    if (target.roleAssignments.some(({ role }) =>
      isProtectedPlatformRole(role.key, role.permissions.map(({ permission }) => permission.key))
    )) throw new Error("Platform administrator accounts cannot be changed through user administration.");
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

const anonymizeSchema = z.object({
  confirmationEmail: z.string().trim().email().max(320),
  reason: z.string().trim().min(5).max(500)
}).strict();

export async function anonymizeAdminUser(userId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(userId);
  const data = anonymizeSchema.parse(input);
  const actor = await requirePlatformManagement(now);
  if (actor.userId === id) throw new Error("Administrators cannot anonymize their own account.");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        anonymizedAt: true
      }
    });
    if (!target) throw new Error("User was not found.");
    if (target.anonymizedAt) throw new Error("The account has already been anonymized.");
    if (target.email.toLocaleLowerCase() !== data.confirmationEmail.toLocaleLowerCase()) {
      throw new Error("The confirmation email does not match the account.");
    }
    const anonymizedEmail = `deleted-${id}@redacted.invalid`.toLocaleLowerCase();
    const claimed = await tx.user.updateMany({
      where: { id, anonymizedAt: null },
      data: {
        email: anonymizedEmail,
        emailNormalized: anonymizedEmail,
        displayName: null,
        passwordHash: null,
        status: UserStatus.DISABLED,
        anonymizedAt: now,
        emailVerifiedAt: null
      }
    });
    if (claimed.count !== 1) throw new Error("The account changed concurrently. Reload and retry.");

    const assignments = await tx.userRoleAssignment.findMany({
      where: { userId: id },
      select: {
        role: {
          select: {
            key: true,
            permissions: { select: { permission: { select: { key: true } } } }
          }
        }
      }
    });
    if (assignments.some(({ role }) =>
      isProtectedPlatformRole(role.key, role.permissions.map(({ permission }) => permission.key))
    )) throw new Error("Platform administrator accounts cannot be anonymized.");

    const [seller, products] = await Promise.all([
      tx.seller.updateMany({
        where: { ownerId: id },
        data: { status: SellerStatus.SUSPENDED, displayName: null, legalName: null }
      }),
      tx.product.updateMany({
        where: { store: { seller: { ownerId: id } } },
        data: { status: CatalogEntityStatus.ARCHIVED }
      })
    ]);
    const stores = await tx.store.updateMany({
      where: { seller: { ownerId: id } },
      data: { status: StoreStatus.CLOSED }
    });
    const sessionRevocation = await tx.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now }
    });
    await tx.cartItem.deleteMany({ where: { cart: { userId: id } } });
    await tx.checkoutQuoteAddress.updateMany({
      where: { quote: { userId: id, status: "ACTIVE" } },
      data: {
        recipientName: "Redacted",
        phone: "",
        countryCode: "ZZ",
        countryName: "Redacted",
        line1: "Redacted",
        line2: null,
        city: "Redacted",
        region: null,
        postalCode: null
      }
    });
    await tx.cart.updateMany({ where: { userId: id }, data: { userId: null, status: "ABANDONED" } });
    await tx.checkoutQuote.updateMany({
      where: { userId: id, status: "ACTIVE" },
      data: { userId: null, status: "RELEASED" }
    });
    await Promise.all([
      tx.productReview.updateMany({
        where: { OR: [{ userId: id }, { product: { store: { seller: { ownerId: id } } } }] },
        data: { status: ReviewStatus.HIDDEN }
      }),
      tx.storeReview.updateMany({
        where: { OR: [{ userId: id }, { store: { seller: { ownerId: id } } }] },
        data: { status: ReviewStatus.HIDDEN }
      }),
      tx.productQuestion.updateMany({ where: { userId: id }, data: { status: "HIDDEN" } }),
      tx.productAnswer.updateMany({ where: { userId: id }, data: { status: "HIDDEN" } }),
      tx.sellerStaff.updateMany({
        where: { userId: id, status: { not: "REVOKED" } },
        data: { status: "REVOKED" }
      }),
      tx.sellerStaff.updateMany({ where: { invitedById: id }, data: { invitedById: null } }),
      tx.userRoleAssignment.deleteMany({ where: { userId: id } }),
      tx.passwordResetToken.deleteMany({ where: { userId: id } }),
      tx.verificationToken.deleteMany({ where: { userId: id } }),
      tx.oAuthAccount.deleteMany({ where: { userId: id } }),
      tx.userTwoFactor.deleteMany({ where: { userId: id } }),
      tx.notification.deleteMany({ where: { userId: id } }),
      tx.notificationPreference.deleteMany({ where: { userId: id } }),
      tx.notificationDelivery.deleteMany({ where: { userId: id } }),
      tx.favorite.deleteMany({ where: { userId: id } }),
      tx.userAddress.deleteMany({ where: { userId: id } }),
      tx.couponRedemption.updateMany({ where: { userId: id }, data: { userId: null } }),
      tx.loginAttempt.updateMany({ where: { userId: id }, data: { userId: null } })
    ]);

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: "identity.user.anonymized",
        resource: "user",
        resourceId: id,
        occurredAt: now,
        metadata: {
          previousStatus: target.status,
          reason: data.reason,
          revokedSessions: sessionRevocation.count,
          storesClosed: stores.count,
          productsArchived: products.count,
          sellersSuspended: seller.count,
          preservedFinancialAndAuditRecords: true
        }
      }
    });
    return {
      userId: id,
      anonymizedAt: now.toISOString(),
      storesClosed: stores.count,
      productsArchived: products.count
    };
  });
}
