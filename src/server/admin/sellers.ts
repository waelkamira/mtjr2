import "server-only";

import { AuditActorType, Prisma, SellerStatus, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const sellerListSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.nativeEnum(SellerStatus).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

const storeStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().min(5).max(500)
}).strict();

export async function listAdminSellers(input: unknown, now = new Date()) {
  const filters = sellerListSchema.parse(input);
  await requirePermission({ permissionKey: "users:manage", now });
  const q = filters.q || undefined;
  const where: Prisma.SellerWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(q ? {
      OR: [
        { id: q },
        { legalName: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { owner: { email: { contains: q, mode: "insensitive" } } },
        { owner: { displayName: { contains: q, mode: "insensitive" } } }
      ]
    } : {})
  };
  const [total, items] = await Promise.all([
    prisma.seller.count({ where }),
    prisma.seller.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        status: true,
        legalName: true,
        displayName: true,
        createdAt: true,
        owner: { select: { id: true, email: true, displayName: true, status: true } },
        stores: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, name: true, slug: true, status: true, createdAt: true }
        },
        _count: { select: { stores: true } }
      }
    })
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      stores: item.stores.map((store) => ({ ...store, createdAt: store.createdAt.toISOString() })),
      storeCount: item._count.stores
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit)
  };
}

export async function changeAdminStoreStatus(storeId: string, input: unknown, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(storeId);
  const data = storeStatusSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "users:manage", now });

  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({
      where: { id },
      select: { id: true, status: true, sellerId: true, seller: { select: { status: true } } }
    });
    if (!store) throw new Error("Store was not found.");
    if (store.status === StoreStatus.CLOSED || store.status === StoreStatus.DRAFT) {
      throw new Error("Draft or closed stores cannot be changed through this operation.");
    }
    if (store.status === data.status) throw new Error("The store already has that status.");
    if (data.status === StoreStatus.ACTIVE && store.seller.status !== SellerStatus.ACTIVE) {
      throw new Error("A store cannot be reactivated while its seller is not active.");
    }
    if (store.status !== StoreStatus.ACTIVE && store.status !== StoreStatus.SUSPENDED) {
      throw new Error("This store status transition is not supported.");
    }

    const changed = await tx.store.updateMany({
      where: { id, status: store.status },
      data: { status: data.status }
    });
    if (changed.count !== 1) throw new Error("The store changed concurrently. Reload and retry.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: actor.userId,
        action: data.status === StoreStatus.SUSPENDED ? "store.suspended" : "store.reactivated",
        resource: "store",
        resourceId: id,
        scopeType: "STORE",
        scopeId: id,
        occurredAt: now,
        metadata: { sellerId: store.sellerId, previousStatus: store.status, status: data.status, reason: data.reason }
      }
    });
    return { storeId: id, previousStatus: store.status, status: data.status };
  });
}
