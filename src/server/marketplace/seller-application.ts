import "server-only";

import { AuditActorType, Prisma, SellerStatus, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

const sellerApplicationSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(80)
});
const reviewSchema = z.object({
  sellerId: z.string().trim().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional()
});
const storeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  marketIds: z.array(z.string().trim().min(1)).min(1).max(20)
});

export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;

function isStoreSlugConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.some((field) => field === "slug" || field === "Store_slug_key")
    : typeof target === "string" && (target.includes("slug") || target.includes("Store_slug_key"));
}

function isMatchingStoreRequest(
  store: { sellerId: string; name: string; markets: Array<{ marketId: string }> },
  sellerId: string,
  name: string,
  marketIds: string[]
) {
  const existingMarketIds = store.markets.map(({ marketId }) => marketId).sort();
  const expectedMarketIds = [...marketIds].sort();
  return store.sellerId === sellerId &&
    store.name === name &&
    existingMarketIds.length === expectedMarketIds.length &&
    existingMarketIds.every((marketId, index) => marketId === expectedMarketIds[index]);
}

/** Authenticated user submits one pending seller application. */
export async function submitSellerApplication(input: SellerApplicationInput, now = new Date()) {
  const data = sellerApplicationSchema.parse(input);
  const actor = await requireCurrentSession(now);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.seller.findUnique({ where: { ownerId: actor.userId }, select: { id: true, status: true } });
      if (existing) {
        if (existing.status !== SellerStatus.PENDING) throw new Error("A seller application already exists for this account.");
        return { sellerId: existing.id, status: existing.status, alreadySubmitted: true };
      }
      const seller = await tx.seller.create({
        data: { ownerId: actor.userId, legalName: data.legalName, displayName: data.displayName, status: SellerStatus.PENDING },
        select: { id: true, status: true }
      });
      await tx.auditLog.create({ data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.application.submitted",
        resource: "seller", resourceId: seller.id, occurredAt: now, metadata: { status: seller.status }
      }});
      return { sellerId: seller.id, status: seller.status, alreadySubmitted: false };
    });
  } catch (error) {
    const existing = await prisma.seller.findUnique({ where: { ownerId: actor.userId }, select: { id: true, status: true } });
    if (existing?.status === SellerStatus.PENDING) return { sellerId: existing.id, status: existing.status, alreadySubmitted: true };
    throw error;
  }
}

/** Platform reviewer approves/rejects a pending seller; approval grants the seeded SELLER role atomically. */
export async function reviewSellerApplication(input: z.input<typeof reviewSchema>, now = new Date()) {
  const data = reviewSchema.parse(input);
  if (data.decision === "REJECT" && !data.reason) throw new Error("A rejection reason is required.");
  const actor = await requirePermission({ permissionKey: "users:manage", now });

  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.findUnique({
      where: { id: data.sellerId },
      select: { id: true, ownerId: true, status: true }
    });
    if (!seller) throw new Error("Seller application was not found.");
    if (seller.status !== SellerStatus.PENDING) throw new Error("Only pending seller applications can be reviewed.");

    const nextStatus = data.decision === "APPROVE" ? SellerStatus.ACTIVE : SellerStatus.REJECTED;
    const changed = await tx.seller.updateMany({
      where: { id: seller.id, status: SellerStatus.PENDING },
      data: { status: nextStatus }
    });
    if (changed.count !== 1) throw new Error("Seller application has already been reviewed.");

    if (data.decision === "APPROVE") {
      const role = await tx.role.findUnique({ where: { key: "SELLER" }, select: { id: true } });
      if (!role) throw new Error("SELLER role is missing; run the identity seed before approving sellers.");
      await tx.userRoleAssignment.upsert({
        where: { userId_roleId_scopeType_scopeId: { userId: seller.ownerId, roleId: role.id, scopeType: "GLOBAL", scopeId: "GLOBAL" } },
        create: { userId: seller.ownerId, roleId: role.id, scopeType: "GLOBAL", scopeId: "GLOBAL", assignedBy: actor.userId },
        update: {}
      });
    }

    await tx.auditLog.create({ data: {
      actorType: AuditActorType.USER, actorId: actor.userId,
      action: data.decision === "APPROVE" ? "seller.application.approved" : "seller.application.rejected",
      resource: "seller", resourceId: seller.id, occurredAt: now,
      metadata: { previousStatus: SellerStatus.PENDING, status: nextStatus, reason: data.reason ?? null }
    }});
    return { sellerId: seller.id, status: nextStatus };
  });
}

/** Creates a draft store for the authenticated active seller and enables only active markets. */
export async function createSellerStore(input: z.input<typeof storeSchema>, now = new Date()) {
  const data = storeSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "store:manage", now });
  const marketIds = [...new Set(data.marketIds)];

  let sellerId: string | null = null;
  try {
    return await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({
        where: { ownerId: actor.userId },
        select: { id: true, status: true }
      });
      if (!seller || seller.status !== SellerStatus.ACTIVE) throw new Error("An approved seller account is required to create a store.");
      sellerId = seller.id;

      const existing = await tx.store.findUnique({
        where: { slug: data.slug },
        select: {
          id: true, sellerId: true, name: true, slug: true, status: true,
          markets: { where: { isEnabled: true }, select: { marketId: true } }
        }
      });
      if (existing) {
        if (!isMatchingStoreRequest(existing, seller.id, data.name, marketIds)) {
          throw new Error("This store URL is already in use or its setup details differ.");
        }
        return {
          id: existing.id, name: existing.name, slug: existing.slug, status: existing.status,
          alreadyCreated: true
        };
      }

      const markets = await tx.market.findMany({
        where: { id: { in: marketIds }, status: "ACTIVE", country: { isActive: true }, defaultCurrency: { isActive: true } },
        select: {
          id: true,
          defaultCurrencyCode: true,
          currencies: { where: { isEnabled: true, currency: { isActive: true } }, select: { currencyCode: true } }
        }
      });
      if (markets.length !== marketIds.length ||
        markets.some((market) => !market.currencies.some((currency) => currency.currencyCode === market.defaultCurrencyCode))) {
        throw new Error("Every selected market must be active and have its default currency enabled.");
      }

      const store = await tx.store.create({
        data: {
          sellerId: seller.id, name: data.name, slug: data.slug, status: StoreStatus.DRAFT,
          markets: { create: marketIds.map((marketId) => ({ marketId, isEnabled: true })) }
        },
        select: { id: true, name: true, slug: true, status: true }
      });
      await tx.auditLog.create({ data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "store.created",
        resource: "store", resourceId: store.id, scopeType: "STORE", scopeId: store.id,
        occurredAt: now, metadata: { slug: store.slug, marketIds }
      }});
      return { ...store, alreadyCreated: false };
    });
  } catch (error) {
    if (!isStoreSlugConflict(error) || !sellerId) throw error;

    const existing = await prisma.store.findUnique({
      where: { slug: data.slug },
      select: {
        id: true, sellerId: true, name: true, slug: true, status: true,
        markets: { where: { isEnabled: true }, select: { marketId: true } }
      }
    });
    if (!existing) throw error;
    if (!isMatchingStoreRequest(existing, sellerId, data.name, marketIds)) {
      throw new Error("This store URL is already in use or its setup details differ.");
    }
    return {
      id: existing.id, name: existing.name, slug: existing.slug, status: existing.status,
      alreadyCreated: true
    };
  }
}


/** Returns only stores owned by the current seller or explicitly joined as active staff. */
export async function getSellerWorkspace(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const seller = await prisma.seller.findUnique({
    where: { ownerId: actor.userId },
    select: { id: true, status: true, legalName: true, displayName: true }
  });
  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { seller: { ownerId: actor.userId } },
        { staff: { some: { userId: actor.userId, status: "ACTIVE" } } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, name: true, slug: true, status: true,
      seller: { select: { ownerId: true } },
      markets: { where: { isEnabled: true }, select: { market: { select: { id: true, code: true, name: true, defaultCurrencyCode: true } } } },
      warehouses: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true, _count: { select: { inventories: true } } }
      }
    }
  });
  return {
    seller,
    stores: stores.map(({ seller: storeSeller, ...store }) => ({
      ...store,
      isOwner: storeSeller.ownerId === actor.userId
    }))
  };
}


/** Platform-only queue of seller applications awaiting review. */
export async function listPendingSellerApplications(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  return prisma.seller.findMany({
    where: { status: SellerStatus.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: { id: true, legalName: true, displayName: true, createdAt: true, owner: { select: { id: true, email: true, displayName: true } } }
  });
}
