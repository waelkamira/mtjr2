import "server-only";

import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

export async function listSellerReturnRequests(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const platformAdmin = await userHasPermission(actor.userId, { permissionKey: "users:manage", now });
  const stores = await prisma.store.findMany({
    where: platformAdmin ? { seller: { status: "ACTIVE" } } : {
      OR: [
        { seller: { ownerId: actor.userId, status: "ACTIVE" } },
        { staff: { some: { userId: actor.userId, status: "ACTIVE" } } }
      ]
    },
    select: { id: true, name: true, seller: { select: { ownerId: true, status: true } } }
  });

  const permittedStoreIds = (await Promise.all(stores.map(async (store) => {
    const isOwner = store.seller.ownerId === actor.userId;
    const delegated = await userHasScopedPermission(actor.userId, {
      permissionKey: "orders:manage",
      scope: { type: "STORE", id: store.id },
      now
    });
    return store.seller.status === "ACTIVE" && (platformAdmin || isOwner || delegated) ? store.id : null;
  }))).filter((id): id is string => Boolean(id));

  if (!permittedStoreIds.length) return { items: [] };

  const requests = await prisma.returnRequest.findMany({
    where: {
      items: {
        some: {
          orderItem: { vendorOrder: { storeId: { in: permittedStoreIds } } }
        }
      }
    },
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    take: 200,
    include: {
      order: { select: { orderNumber: true } },
      items: {
        where: {
          orderItem: { vendorOrder: { storeId: { in: permittedStoreIds } } }
        },
        include: {
          orderItem: {
            select: {
              productName: true,
              sku: true,
              quantity: true,
              vendorOrder: {
                select: { storeId: true, store: { select: { name: true } } }
              }
            }
          }
        }
      }
    }
  });

  const items = requests.flatMap((request) => {
    const byStore = new Map<string, {
      storeName: string;
      products: Array<{ productName: string; sku: string; orderedQuantity: number; returnQuantity: number }>;
    }>();
    for (const item of request.items) {
      const vendor = item.orderItem.vendorOrder;
      const group = byStore.get(vendor.storeId) ?? { storeName: vendor.store.name, products: [] };
      group.products.push({
        productName: item.orderItem.productName,
        sku: item.orderItem.sku,
        orderedQuantity: item.orderItem.quantity,
        returnQuantity: item.quantity
      });
      byStore.set(vendor.storeId, group);
    }
    return [...byStore.entries()].map(([storeId, group]) => ({
      id: request.id,
      returnNumber: request.returnNumber,
      orderNumber: request.order.orderNumber,
      status: request.status,
      reasonCode: request.reasonCode,
      reasonDetails: request.reasonDetails,
      reviewNote: request.reviewNote,
      requestedAt: request.requestedAt.toISOString(),
      storeId,
      storeName: group.storeName,
      items: group.products
    }));
  });

  return { items };
}
