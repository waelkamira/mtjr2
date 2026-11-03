import "server-only";

import { AuditActorType, SellerStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";

const sellerApplicationSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(80)
});

export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;

/**
 * Creates the authenticated user's seller application.
 * Approval and seller-role assignment are deliberately separate admin actions.
 */
export async function submitSellerApplication(input: SellerApplicationInput, now = new Date()) {
  const data = sellerApplicationSchema.parse(input);
  const actor = await requireCurrentSession(now);

  if (!actor.user.emailVerifiedAt) {
    throw new Error("A verified email address is required to apply as a seller.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.seller.findUnique({
        where: { ownerId: actor.userId },
        select: { id: true, status: true }
      });

      if (existing) {
        if (existing.status !== SellerStatus.PENDING) {
          throw new Error("A seller application already exists for this account.");
        }
        return { sellerId: existing.id, status: existing.status, alreadySubmitted: true };
      }

      const seller = await tx.seller.create({
        data: {
          ownerId: actor.userId,
          legalName: data.legalName,
          displayName: data.displayName,
          status: SellerStatus.PENDING
        },
        select: { id: true, status: true }
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: actor.userId,
          action: "seller.application.submitted",
          resource: "seller",
          resourceId: seller.id,
          occurredAt: now,
          metadata: { status: seller.status }
        }
      });

      return { sellerId: seller.id, status: seller.status, alreadySubmitted: false };
    });
  } catch (error) {
    // A concurrent request may win the unique ownerId constraint. Return its
    // pending application instead of creating a second logical submission.
    const existing = await prisma.seller.findUnique({
      where: { ownerId: actor.userId },
      select: { id: true, status: true }
    });
    if (existing?.status === SellerStatus.PENDING) {
      return { sellerId: existing.id, status: existing.status, alreadySubmitted: true };
    }
    throw error;
  }
}
