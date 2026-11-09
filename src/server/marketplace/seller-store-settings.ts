import "server-only";

import { AuditActorType, Prisma, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shippingContactName: z.string().trim().max(120).nullable().optional(),
  shippingPhone: z.string().trim().max(25).regex(/^\+?[0-9\s().-]{7,25}$/).nullable().optional(),
  shippingAddressLine1: z.string().trim().max(240).nullable().optional(),
  shippingAddressLine2: z.string().trim().max(240).nullable().optional(),
  shippingCity: z.string().trim().max(120).nullable().optional(),
  shippingRegion: z.string().trim().max(120).nullable().optional(),
  shippingPostalCode: z.string().trim().max(40).nullable().optional(),
  shippingCountryCode: z.string().trim().length(2).toUpperCase().nullable().optional(),
  shippingInstructions: z.string().trim().max(1000).nullable().optional()
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
        shippingContactName: true, shippingPhone: true, shippingAddressLine1: true, shippingAddressLine2: true,
        shippingCity: true, shippingRegion: true, shippingPostalCode: true, shippingCountryCode: true, shippingInstructions: true,
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

    const updateData: Prisma.StoreUpdateInput = {
      name: data.name,
      slug: data.slug,
      ...(data.shippingContactName !== undefined ? { shippingContactName: data.shippingContactName } : {}),
      ...(data.shippingPhone !== undefined ? { shippingPhone: data.shippingPhone } : {}),
      ...(data.shippingAddressLine1 !== undefined ? { shippingAddressLine1: data.shippingAddressLine1 } : {}),
      ...(data.shippingAddressLine2 !== undefined ? { shippingAddressLine2: data.shippingAddressLine2 } : {}),
      ...(data.shippingCity !== undefined ? { shippingCity: data.shippingCity } : {}),
      ...(data.shippingRegion !== undefined ? { shippingRegion: data.shippingRegion } : {}),
      ...(data.shippingPostalCode !== undefined ? { shippingPostalCode: data.shippingPostalCode } : {}),
      ...(data.shippingCountryCode !== undefined ? { shippingCountryCode: data.shippingCountryCode } : {}),
      ...(data.shippingInstructions !== undefined ? { shippingInstructions: data.shippingInstructions } : {})
    };
    let updated: { id: string; name: string; slug: string; status: StoreStatus; shippingContactName: string | null; shippingPhone: string | null; shippingAddressLine1: string | null; shippingAddressLine2: string | null; shippingCity: string | null; shippingRegion: string | null; shippingPostalCode: string | null; shippingCountryCode: string | null; shippingInstructions: string | null };
    try {
      updated = await tx.store.update({
        where: { id: storeId },
        data: updateData,
        select: { id: true, name: true, slug: true, status: true, shippingContactName: true, shippingPhone: true, shippingAddressLine1: true, shippingAddressLine2: true, shippingCity: true, shippingRegion: true, shippingPostalCode: true, shippingCountryCode: true, shippingInstructions: true }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new SellerStoreSettingsConflictError("SLUG_TAKEN");
      }
      throw error;
    }
    const previousShipping = { shippingContactName: current.shippingContactName, shippingPhone: current.shippingPhone, shippingAddressLine1: current.shippingAddressLine1, shippingAddressLine2: current.shippingAddressLine2, shippingCity: current.shippingCity, shippingRegion: current.shippingRegion, shippingPostalCode: current.shippingPostalCode, shippingCountryCode: current.shippingCountryCode, shippingInstructions: current.shippingInstructions };
    const nextShipping = { shippingContactName: updated.shippingContactName, shippingPhone: updated.shippingPhone, shippingAddressLine1: updated.shippingAddressLine1, shippingAddressLine2: updated.shippingAddressLine2, shippingCity: updated.shippingCity, shippingRegion: updated.shippingRegion, shippingPostalCode: updated.shippingPostalCode, shippingCountryCode: updated.shippingCountryCode, shippingInstructions: updated.shippingInstructions };
    if (updated.name !== current.name || updated.slug !== current.slug || JSON.stringify(previousShipping) !== JSON.stringify(nextShipping)) {
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
          metadata: { previous: { name: current.name, slug: current.slug, ...previousShipping }, next: { name: updated.name, slug: updated.slug, ...nextShipping } }
        }
      });
    }
    return updated;
  });
}
