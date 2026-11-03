import "server-only";

import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { prisma } from "@/lib/db/prisma";

export async function listSellerVendorOrders(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const [platformAdmin, stores] = await Promise.all([
    userHasPermission(actor.userId, { permissionKey: "users:manage", now }),
    prisma.store.findMany({
      where: {
        OR: [
          { seller: { ownerId: actor.userId } },
          { staff: { some: { userId: actor.userId, status: "ACTIVE" } } }
        ]
      },
      select: { id: true, name: true, seller: { select: { ownerId: true, status: true } } }
    })
  ]);
  const allowed = await Promise.all(stores.map(async (store) => {
    const isOwner = store.seller.ownerId === actor.userId;
    const delegated = await userHasScopedPermission(actor.userId, {
      permissionKey: "orders:manage", scope: { type: "STORE", id: store.id }, now
    });
    return store.seller.status === "ACTIVE" && (platformAdmin || isOwner || delegated) ? store.id : null;
  }));
  const storeIds = allowed.filter((id): id is string => Boolean(id));
  if (!storeIds.length) return { orders: [] };

  const vendorOrders = await prisma.vendorOrder.findMany({
    where: { storeId: { in: storeIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      store: { select: { id: true, name: true, slug: true } },
      order: { select: { id: true, orderNumber: true, status: true, currencyCode: true, placedAt: true, currency: { select: { minorUnit: true } } } },
      items: { orderBy: { createdAt: "asc" }, select: { id: true, productName: true, sku: true, variantName: true, quantity: true, unitAmountMinor: true, lineTotalMinor: true } }
    }
  });
  return {
    orders: vendorOrders.map((vendor) => ({
      id: vendor.id, status: vendor.status, store: vendor.store,
      order: vendor.order,
      subtotalMinor: vendor.subtotalMinor.toString(), shippingMinor: vendor.shippingMinor.toString(),
      taxMinor: vendor.taxMinor.toString(), totalMinor: vendor.totalMinor.toString(),
      items: vendor.items.map((item) => ({
        ...item, unitAmountMinor: item.unitAmountMinor.toString(), lineTotalMinor: item.lineTotalMinor.toString()
      }))
    }))
  };
}
