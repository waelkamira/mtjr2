import "server-only";

import { AuditActorType, SellerStatus, SellerStaffStatus, StoreStatus, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";
import { requireCurrentSession } from "@/server/identity/current-session";

const storeDetailsSchema = z.object({
  sellerId: z.string().trim().min(1),
  storeName: z.string().trim().min(2).max(120),
  storeSlug: z.string().trim().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  marketIds: z.array(z.string().trim().min(1)).min(1).max(20)
}).strict();

const staffInviteSchema = z.object({
  storeId: z.string().trim().min(1),
  userId: z.string().trim().min(1)
}).strict();

/** Approves a pending seller, creates the first store, grants its scoped seller role, and audits atomically. */
export async function approveSellerAndCreateStore(input: z.infer<typeof storeDetailsSchema>, now = new Date()) {
  const data = storeDetailsSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "platform:manage", now });

  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.findUnique({
      where: { id: data.sellerId },
      select: { id: true, ownerId: true, status: true }
    });
    if (!seller || seller.status !== SellerStatus.PENDING) {
      throw new Error("Only pending seller applications can be approved.");
    }

    const markets = await tx.market.findMany({
      where: { id: { in: data.marketIds }, status: "ACTIVE", country: { isActive: true } },
      select: { id: true, defaultCurrencyCode: true, currencies: { where: { isEnabled: true }, select: { currencyCode: true } } }
    });
    if (markets.length !== new Set(data.marketIds).size ||
      markets.some((market) => !market.currencies.some((currency) => currency.currencyCode === market.defaultCurrencyCode))) {
      throw new Error("Every selected market must be active and have its default currency enabled.");
    }

    const sellerRole = await tx.role.findUnique({ where: { key: "SELLER" }, select: { id: true } });
    if (!sellerRole) throw new Error("SELLER role is missing; run the baseline seed first.");

    const store = await tx.store.create({
      data: {
        sellerId: seller.id,
        name: data.storeName,
        slug: data.storeSlug,
        status: StoreStatus.ACTIVE,
        markets: { create: markets.map((market) => ({ marketId: market.id, isEnabled: true })) }
      },
      select: { id: true, name: true, slug: true, status: true }
    });

    await tx.seller.update({ where: { id: seller.id }, data: { status: SellerStatus.ACTIVE } });
    await tx.userRoleAssignment.create({
      data: { userId: seller.ownerId, roleId: sellerRole.id, scopeType: "STORE", scopeId: store.id, assignedBy: actor.userId }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "seller.application.approved", resource: "seller", resourceId: seller.id,
        scopeType: "STORE", scopeId: store.id, occurredAt: now,
        metadata: { storeId: store.id, marketIds: markets.map((market) => market.id) }
      }
    });
    return { sellerId: seller.id, store };
  });
}

/** Invites an existing active account to one store. The role is granted only after acceptance. */
export async function inviteStoreStaff(input: z.infer<typeof staffInviteSchema>, now = new Date()) {
  const data = staffInviteSchema.parse(input);
  const actor = await requirePermission({
    permissionKey: "store:staff:manage",
    scope: { type: "STORE", id: data.storeId },
    now
  });

  return prisma.$transaction(async (tx) => {
    const [store, target] = await Promise.all([
      tx.store.findUnique({ where: { id: data.storeId }, select: { id: true, status: true } }),
      tx.user.findUnique({ where: { id: data.userId }, select: { id: true, status: true } })
    ]);
    if (!store || store.status !== StoreStatus.ACTIVE) throw new Error("An active store is required.");
    if (!target || target.status !== UserStatus.ACTIVE) throw new Error("Only active accounts can be invited.");
    if (target.id === actor.userId) throw new Error("Store owners cannot invite themselves as staff.");

    const membership = await tx.sellerStaff.upsert({
      where: { storeId_userId: { storeId: store.id, userId: target.id } },
      create: { storeId: store.id, userId: target.id, invitedById: actor.userId, status: SellerStaffStatus.INVITED },
      update: { invitedById: actor.userId, status: SellerStaffStatus.INVITED, acceptedAt: null },
      select: { id: true, status: true, storeId: true, userId: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "store.staff.invited", resource: "seller_staff", resourceId: membership.id,
        scopeType: "STORE", scopeId: store.id, occurredAt: now,
        metadata: { invitedUserId: target.id }
      }
    });
    return membership;
  });
}

/** Accepts only the current user's own pending invitation and grants STORE_MANAGER in that store scope. */
export async function acceptStoreStaffInvitation(membershipId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(membershipId);
  const actor = await requireCurrentSession(now);

  return prisma.$transaction(async (tx) => {
    const membership = await tx.sellerStaff.findUnique({
      where: { id },
      select: { id: true, userId: true, storeId: true, status: true }
    });
    if (!membership || membership.userId !== actor.userId || membership.status !== SellerStaffStatus.INVITED) {
      throw new Error("A matching pending invitation is required.");
    }

    const managerRole = await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true } });
    if (!managerRole) throw new Error("STORE_MANAGER role is missing; run the baseline seed first.");

    const accepted = await tx.sellerStaff.update({
      where: { id },
      data: { status: SellerStaffStatus.ACTIVE, acceptedAt: now },
      select: { id: true, storeId: true, status: true }
    });
    await tx.userRoleAssignment.upsert({
      where: { userId_roleId_scopeType_scopeId: {
        userId: actor.userId, roleId: managerRole.id, scopeType: "STORE", scopeId: membership.storeId
      } },
      create: { userId: actor.userId, roleId: managerRole.id, scopeType: "STORE", scopeId: membership.storeId, assignedBy: membership.userId },
      update: { expiresAt: null }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "store.staff.accepted", resource: "seller_staff", resourceId: accepted.id,
        scopeType: "STORE", scopeId: membership.storeId, occurredAt: now
      }
    });
    return accepted;
  });
}
