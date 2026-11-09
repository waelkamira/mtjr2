import "server-only";

import { AuditActorType, Prisma, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession, AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
}).strict();

export class SellerStoreSettingsConflictError extends Error {
  constructor(readonly code: "STORE_NOT_FOUND" | "STORE_NOT_ACTIVE" | "SLUG_TAKEN" | "SLUG_LOCKED") {
    super(code);
    this.name = "SellerStoreSettingsConflictError";
  }
}

/** Update only the public name and URL slug of a store owned or managed in the exact store scope. */
export async function updateSellerStoreSettings(storeIdInput: string, input: unknown, now = new Date()) {
  const actor = await requireCurrentSession(now);
  const storeId = z.string().trim().min(1).max(128).parse(storeIdInput);
  const data = updateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
    const current = await tx.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, sellerId: true, name: true, slug: true, status: true,
        seller: { select: { ownerId: true, status: true } }
      }
    });
    if (!current) throw new SellerStoreSettingsConflictError("STORE_NOT_FOUND");
    if (current.seller.status !== "ACTIVE" || ![StoreStatus.ACTIVE, StoreStatus.DRAFT].includes(current.status)) {
      throw new SellerStoreSettingsConflictError("STORE_NOT_ACTIVE");
    }

    if (current.status === StoreStatus.ACTIVE && data.slug !== current.slug) {
      throw new SellerStoreSettingsConflictError("SLUG_LOCKED");
    }

    const isOwner = current.seller.ownerId === actor.userId;
    if (!isOwner) {
      const allowed = await userHasScopedPermission(actor.userId, {
        permissionKey: "store:manage",
        scope: { type: "STORE", id: storeId },
        now
      });
      if (!allowed) throw new PermissionDeniedError();
    }

    const slugOwner = await tx.store.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (slugOwner && slugOwner.id !== storeId) throw new SellerStoreSettingsConflictError("SLUG_TAKEN");

    let updated: { id: string; name: string; slug: string; status: StoreStatus };
    try {
      updated = await tx.store.update({
        where: { id: storeId },
        data: { name: data.name, slug: data.slug },
        select: { id: true, name: true, slug: true, status: true }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new SellerStoreSettingsConflictError("SLUG_TAKEN");
      }
      throw error;
    }
    if (updated.name !== current.name || updated.slug !== current.slug) {
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: actor.userId,
          action: "store.settings_updated",
          resource: "store",
          resourceId: storeId,
          scopeType: "STORE",
          scopeId: storeId,
          occurredAt: now,
          metadata: { previous: { name: current.name, slug: current.slug }, next: { name: updated.name, slug: updated.slug } }
        }
      });
    }
    return updated;
  });
}
