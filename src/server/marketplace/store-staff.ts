import "server-only";

import { AuditActorType, SellerStaffStatus, UserStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const inviteSchema = z.object({
  storeId: z.string().trim().min(1),
  userId: z.string().trim().min(1)
});

async function requireStoreStaffManager(tx: Prisma.TransactionClient, storeId: string, userId: string, now: Date) {
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: { id: true, seller: { select: { ownerId: true, status: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE") throw new Error("Active store not found.");
  if (store.seller.ownerId !== userId) {
    const allowed = await userHasScopedPermission(userId, {
      permissionKey: "store:staff:manage",
      scope: { type: "STORE", id: storeId },
      now
    });
    if (!allowed) throw new Error("You cannot manage staff for this store.");
  }
  return store;
}

/** Store owner or explicitly scoped staff manager invites an active account. */
export async function inviteStoreStaff(input: z.input<typeof inviteSchema>, now = new Date()) {
  const data = inviteSchema.parse(input);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    await requireStoreStaffManager(tx, data.storeId, actor.userId, now);
    const target = await tx.user.findUnique({ where: { id: data.userId }, select: { id: true, status: true } });
    if (!target || target.status !== UserStatus.ACTIVE) throw new Error("Only active accounts can be invited.");
    const membership = await tx.sellerStaff.upsert({
      where: { storeId_userId: { storeId: data.storeId, userId: target.id } },
      create: { storeId: data.storeId, userId: target.id, invitedById: actor.userId, status: SellerStaffStatus.INVITED, invitedAt: now },
      update: { status: SellerStaffStatus.INVITED, invitedById: actor.userId, invitedAt: now, acceptedAt: null }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "store.staff.invited",
      resource: "seller_staff", resourceId: membership.id, scopeType: "STORE", scopeId: data.storeId,
      occurredAt: now, metadata: { invitedUserId: target.id }
    }});
    return { membershipId: membership.id, status: membership.status };
  });
}

/** The invited account accepts its own invitation and receives a store-scoped STORE_MANAGER grant. */
export async function acceptStoreStaffInvitation(membershipId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(membershipId);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.sellerStaff.findUnique({
      where: { id },
      select: { id: true, userId: true, storeId: true, status: true, store: { select: { seller: { select: { status: true } } } } }
    });
    if (!membership || membership.userId !== actor.userId) throw new Error("Invitation not found.");
    if (membership.status !== SellerStaffStatus.INVITED || membership.store.seller.status !== "ACTIVE") {
      throw new Error("This staff invitation is no longer valid.");
    }
    const role = await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true } });
    if (!role) throw new Error("STORE_MANAGER role is missing; run the identity seed first.");
    const updated = await tx.sellerStaff.updateMany({
      where: { id, userId: actor.userId, status: SellerStaffStatus.INVITED },
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

/** Store owner or scoped manager revokes membership and its store-scoped role grant. */
export async function revokeStoreStaff(membershipId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(membershipId);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.sellerStaff.findUnique({
      where: { id }, select: { id: true, userId: true, storeId: true, status: true }
    });
    if (!membership) return false;
    await requireStoreStaffManager(tx, membership.storeId, actor.userId, now);
    const updated = await tx.sellerStaff.updateMany({
      where: { id, status: { in: [SellerStaffStatus.INVITED, SellerStaffStatus.ACTIVE] } },
      data: { status: SellerStaffStatus.REVOKED }
    });
    if (updated.count !== 1) return false;
    const role = await tx.role.findUnique({ where: { key: "STORE_MANAGER" }, select: { id: true } });
    if (role) await tx.userRoleAssignment.deleteMany({
      where: { userId: membership.userId, roleId: role.id, scopeType: "STORE", scopeId: membership.storeId }
    });
    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId, action: "store.staff.revoked",
      resource: "seller_staff", resourceId: id, scopeType: "STORE", scopeId: membership.storeId,
      occurredAt: now, metadata: { revokedUserId: membership.userId }
    }});
    return true;
  });
}


/** Lists staff and outstanding invitations for a store after checking management scope. */
export async function listStoreStaff(storeIdInput: string, now = new Date()) {
  const storeId = z.string().trim().min(1).parse(storeIdInput);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    await requireStoreStaffManager(tx, storeId, actor.userId, now);
    return tx.sellerStaff.findMany({
      where: { storeId },
      orderBy: [{ status: "asc" }, { invitedAt: "desc" }],
      take: 100,
      select: {
        id: true, status: true, invitedAt: true, acceptedAt: true,
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
    where: { userId: actor.userId, status: SellerStaffStatus.INVITED, store: { seller: { status: "ACTIVE" } } },
    orderBy: [{ invitedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true, invitedAt: true,
      store: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { displayName: true, email: true } }
    }
  });
}
