import "server-only";

import { AuditActorType, Prisma, SellerStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";

const sellerProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254),
  phoneNumber: z.string().trim().min(7).max(25).regex(/^\+?[0-9\s().-]{7,25}$/),
  residence: z.string().trim().min(3).max(240),
  description: z.string().trim().max(4000).nullable(),
  facebookUrl: z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Only HTTPS links are accepted.").nullable(),
  youtubeUrl: z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Only HTTPS links are accepted.").nullable(),
  twitterUrl: z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Only HTTPS links are accepted.").nullable()
}).strict();

const sellerProfileSelect = {
  id: true,
  status: true,
  legalName: true,
  displayName: true,
  contactName: true,
  contactEmail: true,
  phoneNumber: true,
  residence: true,
  description: true,
  facebookUrl: true,
  youtubeUrl: true,
  twitterUrl: true
} satisfies Prisma.SellerSelect;

export async function getMySellerProfile(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const seller = await prisma.seller.findUnique({
    where: { ownerId: actor.userId },
    select: sellerProfileSelect
  });
  if (!seller || seller.status !== SellerStatus.ACTIVE) {
    throw new PermissionDeniedError("An active seller profile is required.");
  }
  return {
    ...seller,
    displayName: seller.displayName ?? "",
    contactName: seller.contactName ?? "",
    contactEmail: seller.contactEmail ?? "",
    phoneNumber: seller.phoneNumber ?? "",
    residence: seller.residence ?? ""
  };
}

export async function updateMySellerProfile(input: unknown, now = new Date()) {
  const actor = await requireCurrentSession(now);
  const data = sellerProfileSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Seller" WHERE "ownerId" = ${actor.userId} FOR UPDATE`;
    const current = await tx.seller.findUnique({
      where: { ownerId: actor.userId },
      select: sellerProfileSelect
    });
    if (!current || current.status !== SellerStatus.ACTIVE) {
      throw new PermissionDeniedError("An active seller profile is required.");
    }
    const updated = await tx.seller.update({
      where: { id: current.id },
      data,
      select: sellerProfileSelect
    });
    const changedFields = Object.keys(data).filter((key) =>
      current[key as keyof typeof current] !== updated[key as keyof typeof updated]
    );
    if (changedFields.length) {
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: actor.userId,
          action: "seller.profile_updated",
          resource: "seller",
          resourceId: current.id,
          occurredAt: now,
          metadata: { changedFields }
        }
      });
    }
    return updated;
  });
}
