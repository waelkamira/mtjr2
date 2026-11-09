import "server-only";

import { AuditActorType, SellerStaffStatus, UserStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

const inviteSchema = z.object({
  storeId: z.string().trim().min(1),
  userId: z.string().trim().min(1).max(128).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  roleKey: z.enum(["STORE_MANAGER", "STORE_CATALOG_MANAGER", "STORE_INVENTORY_MANAGER", "STORE_ORDER_MANAGER", "STORE_CUSTOMER_CARE", "STORE_MARKETING_MANAGER"]).default("STORE_MANAGER")
}).refine((value) => Boolean(value.userId) !== Boolean(value.email), { message: "Provide exactly one account ID or email address." });

async function requireStoreOwner(tx: Prisma.TransactionClient, storeId: string, userId: string) {
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE") throw new Error("Active store not found.");
  if (store.seller.ownerId !== userId) {
    throw new Error("Only the store owner can manage this store's team.");
  }
  return store;
}

/** Only the store owner may invite an active account and select its store-scoped role. */
export async function inviteStoreStaff(input: z.input<typeof inviteSchema>, now = new Date()) {
  const data = inviteSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    await requireStoreOwner(tx, data.storeId, actor.userId);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const role = await tx.role.findUnique({ where: { key: data.roleKey }, select: { id: true, key: true } });
    if (!role) throw new Error("The selected store role is not available. Run the identity seed first.");
    const target = await tx.user.findUnique({
      where: data.email ? { email: data.email } : { id: data.userId! },
      select: { id: true, status: true }
    });
    if (!target || target.status !== UserStatus.ACTIVE) throw new Error("Only active accounts can be invited.");
    const previousMembership = await tx.sellerStaff.findUnique({
      where: { storeId_userId: { storeId: data.storeId, userId: target.id } },
      select: { id: true, status: true, roleId: true }
    });
    if (previousMembership) {
      const previousRole = previousMembership.roleId
        ? previousMembership.roleId
        : (await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true } }))?.id;
      if (previousRole) await tx.userRoleAssignment.deleteMany({
        where: { userId: target.id, roleId: previousRole, scopeType: "STORE", scopeId: data.storeId }
      });
    }
    const membership = await tx.sellerStaff.upsert({
      where: { storeId_userId: { storeId: data.storeId, userId: target.id } },
      create: { storeId: data.storeId, userId: target.id, roleId: role.id, invitedById: actor.userId, status: SellerStaffStatus.INVITED, invitedAt: now, expiresAt },
      update: { roleId: role.id, status: SellerStaffStatus.INVITED, invitedById: actor.userId, invitedAt: now, expiresAt, acceptedAt: null }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "store.staff.invited",
      resource: "seller_staff", resourceId: membership.id, scopeType: "STORE", scopeId: data.storeId,
      occurredAt: now, metadata: { invitedUserId: target.id, roleKey: role.key }
    }});
    return { membershipId: membership.id, status: membership.status };
  });
}

/** The invited account accepts its own invitation and receives its selected store-scoped role grant. */
export async function acceptStoreStaffInvitation(membershipId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(membershipId);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.sellerStaff.findUnique({
      where: { id },
      select: { id: true, userId: true, storeId: true, status: true, roleId: true, expiresAt: true, store: { select: { seller: { select: { status: true } } } } }
    });
    if (!membership || membership.userId !== actor.userId) throw new Error("Invitation not found.");
    if (membership.status !== SellerStaffStatus.INVITED || membership.store.seller.status !== "ACTIVE" || (membership.expiresAt !== null && membership.expiresAt <= now)) {
      throw new Error("This staff invitation is no longer valid.");
    }
    const role = membership.roleId
      ? await tx.role.findUnique({ where: { id: membership.roleId }, select: { id: true, key: true } })
      : await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true, key: true } });
    if (!role) throw new Error("The invited store role is missing; run the identity seed first.");
    const updated = await tx.sellerStaff.updateMany({
      where: { id, userId: actor.userId, status: SellerStaffStatus.INVITED, roleId: membership.roleId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      data: { status: SellerStaffStatus.ACTIVE, acceptedAt: now }
    });
    if (updated.count !== 1) throw new Error("Invitation has already been accepted or revoked.");
    await tx.userRoleAssignment.upsert({
      where: { userId_roleId_scopeType_scopeId: { userId: actor.userId, roleId: role.id, scopeType: "STORE", scopeId: membership.storeId } },
      create: { userId: actor.userId, roleId: role.id, scopeType: "STORE", scopeId: membership.storeId, assignedBy: null },
      update: {}
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "store.staff.accepted",
      resource: "seller_staff", resourceId: id, scopeType: "STORE", scopeId: membership.storeId,
      occurredAt: now
    }});
    return { membershipId: id, status: SellerStaffStatus.ACTIVE };
  });
}

/** Changes one member's role without leaving a gap in access or retaining the previous grant. */
export async function changeStoreStaffRole(membershipIdInput: string, roleKeyInput: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(membershipIdInput);
  const roleKey = z.enum(["STORE_MANAGER", "STORE_CATALOG_MANAGER", "STORE_INVENTORY_MANAGER", "STORE_ORDER_MANAGER", "STORE_CUSTOMER_CARE", "STORE_MARKETING_MANAGER"]).parse(roleKeyInput);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.sellerStaff.findUnique({
      where: { id }, select: { id: true, userId: true, storeId: true, status: true, roleId: true }
    });
    if (!membership || ![SellerStaffStatus.INVITED, SellerStaffStatus.ACTIVE].includes(membership.status)) {
      throw new Error("An active or pending staff membership is required.");
    }
    await requireStoreOwner(tx, membership.storeId, actor.userId);
    const nextRole = await tx.role.findUnique({ where: { key: roleKey }, select: { id: true, key: true } });
    if (!nextRole) throw new Error("The selected store role is not available. Run the identity seed first.");
    const previousRoleId = membership.roleId ?? (await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true } }))?.id ?? null;
    if (previousRoleId === nextRole.id) return { membershipId: id, roleKey: nextRole.key, changed: false };
    if (membership.status === SellerStaffStatus.ACTIVE && previousRoleId) {
      await tx.userRoleAssignment.deleteMany({
        where: { userId: membership.userId, roleId: previousRoleId, scopeType: "STORE", scopeId: membership.storeId }
      });
    }
    const updated = await tx.sellerStaff.updateMany({
      where: { id, status: membership.status, roleId: membership.roleId },
      data: { roleId: nextRole.id }
    });
    if (updated.count !== 1) throw new Error("The staff membership changed. Reload and try again.");
    if (membership.status === SellerStaffStatus.ACTIVE) {
      await tx.userRoleAssignment.upsert({
        where: { userId_roleId_scopeType_scopeId: { userId: membership.userId, roleId: nextRole.id, scopeType: "STORE", scopeId: membership.storeId } },
        create: { userId: membership.userId, roleId: nextRole.id, scopeType: "STORE", scopeId: membership.storeId, assignedBy: actor.userId },
        update: { assignedBy: actor.userId }
      });
    }
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "store.staff.role_changed",
      resource: "seller_staff", resourceId: id, scopeType: "STORE", scopeId: membership.storeId,
      occurredAt: now, metadata: { previousRoleId, nextRoleKey: nextRole.key, membershipStatus: membership.status }
    }});
    return { membershipId: id, roleKey: nextRole.key, changed: true };
  });
}

/** Only the store owner revokes membership and its store-scoped role grant. */
export async function revokeStoreStaff(membershipId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(membershipId);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.sellerStaff.findUnique({
      where: { id }, select: { id: true, userId: true, storeId: true, status: true, roleId: true }
    });
    if (!membership) return false;
    await requireStoreOwner(tx, membership.storeId, actor.userId);
    const updated = await tx.sellerStaff.updateMany({
      where: { id, status: { in: [SellerStaffStatus.INVITED, SellerStaffStatus.ACTIVE, SellerStaffStatus.SUSPENDED] } },
      data: { status: SellerStaffStatus.REVOKED }
    });
    if (updated.count !== 1) return false;
    const roleId = membership.roleId ?? (await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true } }))?.id;
    if (roleId) await tx.userRoleAssignment.deleteMany({
      where: { userId: membership.userId, roleId, scopeType: "STORE", scopeId: membership.storeId }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "store.staff.revoked",
      resource: "seller_staff", resourceId: id, scopeType: "STORE", scopeId: membership.storeId,
      occurredAt: now, metadata: { revokedUserId: membership.userId }
    }});
    return true;
  });
}


/** Lists staff and outstanding invitations for a store after checking store ownership. */
export async function listStoreStaff(storeIdInput: string, now = new Date()) {
  const storeId = z.string().trim().min(1).parse(storeIdInput);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    await requireStoreOwner(tx, storeId, actor.userId);
    return tx.sellerStaff.findMany({
      where: { storeId },
      orderBy: [{ status: "asc" }, { invitedAt: "desc" }],
      take: 100,
      select: {
        id: true, status: true, invitedAt: true, expiresAt: true, acceptedAt: true,
        role: { select: { key: true, name: true } },
        user: { select: { id: true, email: true, displayName: true } },
        invitedBy: { select: { id: true, email: true, displayName: true } }
      }
    });
  });
}


/** Lists invitations addressed to the authenticated user. */
export async function listMyStaffInvitations(now = new Date()) {
  const actor = await requireCurrentSession(now);
  return prisma.sellerStaff.findMany({
    where: { userId: actor.userId, status: SellerStaffStatus.INVITED, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], store: { seller: { status: "ACTIVE" } } },
    orderBy: [{ invitedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true, invitedAt: true, expiresAt: true,
      store: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { displayName: true, email: true } }
    }
  });
}
