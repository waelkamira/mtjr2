import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { CartStatus, CheckoutQuoteStatus, InventoryMovementType, InventoryReservationStatus, OrderStatus, PaymentStatus, Prisma, ShipmentTrackingStatus, VendorOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { getCheckoutQuote } from "@/server/checkout/quotes";
import { createInAppNotification } from "@/server/notifications/notifications";
import { addCartItems } from "@/server/cart/cart";
import { z } from "zod";

const reservationReference = "CHECKOUT_QUOTE";

type Owner = { userId: string } | { guestSessionId: string };
function ownerWhere(owner: Owner) {
  return "userId" in owner ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId };
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function makeOrderNumber() {
  return `MTJ-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
function allocateAmount(total: bigint, bases: Array<{ storeId: string; base: bigint }>) {
  const positive = bases.filter((entry) => entry.base > BigInt(0)).sort((a, b) => a.storeId.localeCompare(b.storeId));
  const denominator = positive.reduce((sum, entry) => sum + entry.base, BigInt(0));
  if (total === BigInt(0)) return new Map(bases.map((entry) => [entry.storeId, BigInt(0)]));
  if (denominator <= BigInt(0)) throw new Error("Tax allocation has no taxable vendor amount.");
  const result = new Map<string, bigint>();
  let allocated = BigInt(0);
  positive.forEach((entry, index) => {
    const share = index === positive.length - 1 ? total - allocated : (total * entry.base) / denominator;
    result.set(entry.storeId, share);
    allocated += share;
  });
  for (const entry of bases) if (!result.has(entry.storeId)) result.set(entry.storeId, BigInt(0));
  return result;
}

function serializeOrder(order: {
  id: string; orderNumber: string; status: OrderStatus; currencyCode: string; currency: { minorUnit: number; symbol: string | null };
  subtotalMinor: bigint; couponCode: string | null; discountMinor: bigint; shippingMinor: bigint; taxMinor: bigint; totalMinor: bigint;
  taxRuleName: string; taxRateBasisPoints: number; taxInclusive: boolean; taxIncludesShipping: boolean; taxDestinationRegion: string | null;
  placedAt: Date;
  statusHistory?: Array<{ status: OrderStatus; note: string | null; createdAt: Date }>;
  payments?: Array<{ id: string; status: PaymentStatus }>;
  address: { recipientName: string; phone: string; countryCode: string; countryName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null } | null;
  vendorOrders: Array<{
    id: string; status: VendorOrderStatus; store: { id: string; name: string; slug: string };
    shippingServiceName: string; shippingDestinationRegion: string | null; minDeliveryDays: number | null; maxDeliveryDays: number | null;
    subtotalMinor: bigint; discountMinor: bigint; shippingMinor: bigint; taxMinor: bigint; totalMinor: bigint;
    items: Array<{ id: string; productName: string; sku: string; variantName: string | null; quantity: number; unitAmountMinor: bigint; lineTotalMinor: bigint }>;
    statusHistory?: Array<{ status: VendorOrderStatus; note: string | null; createdAt: Date }>;
    shipment?: {
      carrierName: string; trackingNumber: string; trackingUrl: string | null; status: ShipmentTrackingStatus; shippedAt: Date;
      events: Array<{ status: ShipmentTrackingStatus; description: string | null; location: string | null; occurredAt: Date }>;
    } | null;
  }>;
}) {
  return {
    id: order.id, orderNumber: order.orderNumber, status: order.status, currencyCode: order.currencyCode, currency: order.currency,
    subtotalMinor: order.subtotalMinor.toString(), couponCode: order.couponCode,
    discountMinor: order.discountMinor.toString(), shippingMinor: order.shippingMinor.toString(),
    taxMinor: order.taxMinor.toString(), totalMinor: order.totalMinor.toString(), tax: { ruleName: order.taxRuleName, rateBasisPoints: order.taxRateBasisPoints, inclusive: order.taxInclusive, includesShipping: order.taxIncludesShipping, destinationRegion: order.taxDestinationRegion }, placedAt: order.placedAt.toISOString(),
    canCancel: order.status === OrderStatus.PENDING_PAYMENT && (order.payments ?? []).every((payment) => payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.CANCELLED),
    statusHistory: (order.statusHistory ?? []).map((event) => ({
      status: event.status, note: event.note, createdAt: event.createdAt.toISOString()
    })),
    address: order.address,
    vendorOrders: order.vendorOrders.map((vendor) => ({
      id: vendor.id, status: vendor.status, store: vendor.store,
      shippingServiceName: vendor.shippingServiceName, shippingDestinationRegion: vendor.shippingDestinationRegion, minDeliveryDays: vendor.minDeliveryDays, maxDeliveryDays: vendor.maxDeliveryDays,
      subtotalMinor: vendor.subtotalMinor.toString(), discountMinor: vendor.discountMinor.toString(),
      shippingMinor: vendor.shippingMinor.toString(),
      taxMinor: vendor.taxMinor.toString(), totalMinor: vendor.totalMinor.toString(),
      statusHistory: (vendor.statusHistory ?? []).map((event) => ({
        status: event.status, note: event.note, createdAt: event.createdAt.toISOString()
      })),
      shipment: vendor.shipment ? {
        carrierName: vendor.shipment.carrierName, trackingNumber: vendor.shipment.trackingNumber,
        trackingUrl: vendor.shipment.trackingUrl, status: vendor.shipment.status,
        shippedAt: vendor.shipment.shippedAt.toISOString(),
        events: vendor.shipment.events.map((event) => ({
          status: event.status, description: event.description, location: event.location,
          occurredAt: event.occurredAt.toISOString()
        }))
      } : null,
      items: vendor.items.map((item) => ({
        id: item.id, productName: item.productName, sku: item.sku, variantName: item.variantName,
        quantity: item.quantity, unitAmountMinor: item.unitAmountMinor.toString(), lineTotalMinor: item.lineTotalMinor.toString()
      }))
    }))
  };
}

/**
 * Converts an owned, fully configured checkout quote into one customer order and
 * one vendor order per store. Stock consumption, reservation consumption, cart
 * closure, quote conversion and immutable snapshots commit in one transaction.
 * Payment remains PENDING_PAYMENT; this function never charges a buyer.
 */
export async function placeOrderFromCheckoutQuote(guestToken: string, quoteId: string, now = new Date()) {
  const visibleQuote = await getCheckoutQuote(guestToken, quoteId, now);
  const session = await getCurrentSession(now);
  const owner: Owner = session
    ? { userId: session.userId }
    : await prisma.guestSession.findUnique({
        where: { tokenHash: hashToken(guestToken) },
        select: { id: true, expiresAt: true, convertedAt: true }
      }).then((guest) => {
        if (!guest || guest.expiresAt <= now || guest.convertedAt) throw new Error("Checkout session expired. Return to your cart and start again.");
        return { guestSessionId: guest.id };
      });

  if (visibleQuote.status === CheckoutQuoteStatus.CONVERTED) {
    const existing = await prisma.order.findFirst({
      where: { quoteId, ...ownerWhere(owner) },
      include: {
        currency: { select: { minorUnit: true, symbol: true } },
        address: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        payments: { select: { id: true, status: true } },
        vendorOrders: { include: {
          store: { select: { id: true, name: true, slug: true } }, items: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
          shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } }
        } }
      }
    });
    if (existing) return serializeOrder(existing);
    throw new Error("This checkout quote was converted but its order record is unavailable.");
  }
  if (visibleQuote.status !== CheckoutQuoteStatus.ACTIVE) throw new Error("This checkout quote is no longer active.");

  try {
    return await prisma.$transaction(async (tx) => {
    const quote = await tx.checkoutQuote.findFirst({
      where: { id: quoteId, ...ownerWhere(owner), status: CheckoutQuoteStatus.ACTIVE, expiresAt: { gt: now } },
      include: {
        deliveryAddress: true,
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            variant: {
              select: {
                productId: true,
                product: {
                  select: {
                    categories: {
                      where: { isPrimary: true },
                      orderBy: [{ sortOrder: "asc" }, { categoryId: "asc" }],
                      select: { categoryId: true, category: { select: { name: true } } },
                      take: 1
                    }
                  }
                }
              }
            }
          }
        },
        shippingSelections: true,
        taxSnapshot: true,
        coupon: { select: { id: true, isActive: true, startsAt: true, expiresAt: true, maxRedemptions: true } },
        cart: { select: { id: true, status: true } }
      }
    });
    if (!quote) throw new Error("Checkout quote is expired or unavailable.");
    if (!quote.deliveryAddress) throw new Error("A delivery address is required before placing an order.");
    if (!quote.taxSnapshot) throw new Error("Calculate tax using a configured market rule before placing an order.");
    if (quote.taxSnapshot.destinationRegion !== (quote.deliveryAddress.region ?? null)) throw new Error("The delivery destination changed. Recalculate tax before placing the order.");
    if (quote.discountMinor < BigInt(0) || quote.discountMinor > quote.subtotalMinor) {
      throw new Error("Checkout coupon snapshot is invalid. Rebuild the quote before placing the order.");
    }
    if (quote.couponId) {
      const coupon = quote.coupon;
      if (!coupon || !coupon.isActive || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt <= now)) {
        throw new Error("This coupon is no longer valid. Rebuild checkout without it.");
      }
      if (coupon.maxRedemptions !== null) {
        const redemptionCount = await tx.couponRedemption.count({ where: { couponId: coupon.id } });
        if (redemptionCount >= coupon.maxRedemptions) throw new Error("This coupon has reached its redemption limit.");
      }
    } else if (quote.discountMinor !== BigInt(0) || quote.couponCode) {
      throw new Error("Checkout coupon snapshot is inconsistent. Rebuild the quote before placing the order.");
    }

    const grouped = new Map<string, typeof quote.lines>();
    for (const line of quote.lines) grouped.set(line.storeId, [...(grouped.get(line.storeId) ?? []), line]);
    const storeIds = [...grouped.keys()].sort();
    const selections = new Map(quote.shippingSelections.map((selection) => [selection.storeId, selection]));
    if (selections.size !== storeIds.length || storeIds.some((storeId) => !selections.has(storeId))) {
      throw new Error("Choose a shipping service for every seller before placing an order.");
    }
    if (quote.shippingSelections.some((selection) => selection.currencyCode !== quote.currencyCode || selection.destinationRegion !== (quote.deliveryAddress?.region ?? null))) {
      throw new Error("A shipping selection no longer matches the checkout destination or currency.");
    }

    const shippingByStore = new Map(storeIds.map((storeId) => [storeId, selections.get(storeId)!.amountMinor]));
    const subtotalByStore = new Map(storeIds.map((storeId) => [
      storeId, grouped.get(storeId)!.reduce((sum, line) => sum + line.lineTotalMinor, BigInt(0))
    ]));
    const discountByStore = allocateAmount(quote.discountMinor, storeIds.map((storeId) => ({
      storeId, base: subtotalByStore.get(storeId)!
    })));
    const taxableBases = storeIds.map((storeId) => ({
      storeId,
      base: subtotalByStore.get(storeId)! - (discountByStore.get(storeId) ?? BigInt(0)) +
        (quote.taxSnapshot!.includesShipping ? shippingByStore.get(storeId)! : BigInt(0))
    }));
    const allocatedTax = allocateAmount(quote.taxSnapshot.taxAmountMinor, taxableBases);
    const subtotal = storeIds.reduce((sum, id) => sum + subtotalByStore.get(id)!, BigInt(0));
    const shipping = storeIds.reduce((sum, id) => sum + shippingByStore.get(id)!, BigInt(0));
    const discountedSubtotal = subtotal - quote.discountMinor;
    const expectedTaxableAmount = discountedSubtotal +
      (quote.taxSnapshot.includesShipping ? shipping : BigInt(0));
    if (subtotal !== quote.subtotalMinor || quote.taxSnapshot.currencyCode !== quote.currencyCode ||
        quote.taxSnapshot.taxableAmountMinor !== expectedTaxableAmount) {
      throw new Error("Checkout snapshots are inconsistent. Rebuild the quote before placing an order.");
    }
    const tax = quote.taxSnapshot.taxAmountMinor;
    const total = discountedSubtotal + shipping + (quote.taxSnapshot.isInclusive ? BigInt(0) : tax);
    const order = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(), quoteId, ...ownerWhere(owner),
        marketId: quote.marketId, currencyCode: quote.currencyCode,
        status: OrderStatus.PENDING_PAYMENT, subtotalMinor: subtotal, couponId: quote.couponId,
        couponCode: quote.couponCode, discountMinor: quote.discountMinor, shippingMinor: shipping,
        taxMinor: tax, taxRuleName: quote.taxSnapshot.ruleName, taxRateBasisPoints: quote.taxSnapshot.rateBasisPoints,
        taxInclusive: quote.taxSnapshot.isInclusive, taxIncludesShipping: quote.taxSnapshot.includesShipping,
        taxDestinationRegion: quote.taxSnapshot.destinationRegion, totalMinor: total, idempotencyKey: `checkout:${quote.id}`,
        placedAt: now,
        address: { create: {
          recipientName: quote.deliveryAddress.recipientName, phone: quote.deliveryAddress.phone,
          countryCode: quote.deliveryAddress.countryCode, countryName: quote.deliveryAddress.countryName,
          line1: quote.deliveryAddress.line1, line2: quote.deliveryAddress.line2,
          city: quote.deliveryAddress.city, region: quote.deliveryAddress.region, postalCode: quote.deliveryAddress.postalCode
        }},
        statusHistory: { create: { status: OrderStatus.PENDING_PAYMENT, note: "Order created; payment has not been initiated." } }
      }
    });
    if (quote.couponId) {
      await tx.couponRedemption.create({
        data: {
          couponId: quote.couponId, orderId: order.id,
          userId: "userId" in owner ? owner.userId : null
        }
      });
    }

    if ("userId" in owner) {
      await createInAppNotification(tx, {
        data: {
          userId: owner.userId, type: "ORDER_PLACED", title: "Order received",
          message: `Order ${order.orderNumber} was created and is awaiting payment.`,
          resourceType: "ORDER", resourceId: order.id, deduplicationKey: `order:${order.id}:buyer:${owner.userId}`
        }
      });
    }

    const reservations = await tx.inventoryReservation.findMany({
      where: { referenceType: reservationReference, referenceId: quote.id, status: InventoryReservationStatus.ACTIVE },
      include: { inventory: { select: { id: true, variantId: true } } }
    });
    const reservedByVariant = new Map<string, number>();
    for (const reservation of reservations) {
      const changed = await tx.inventory.updateMany({
        where: {
          id: reservation.inventoryId,
          quantityOnHand: { gte: reservation.quantity },
          quantityReserved: { gte: reservation.quantity }
        },
        data: {
          quantityOnHand: { decrement: reservation.quantity },
          quantityReserved: { decrement: reservation.quantity }
        }
      });
      if (changed.count !== 1) throw new Error("Reserved inventory changed. The order was not placed; support reconciliation is required.");
      const consumed = await tx.inventoryReservation.updateMany({
        where: { id: reservation.id, status: InventoryReservationStatus.ACTIVE, expiresAt: { gt: now } },
        data: { status: InventoryReservationStatus.CONSUMED, consumedAt: now }
      });
      if (consumed.count !== 1) {
        throw new Error("Inventory reservation expired or was released before order placement. Rebuild checkout.");
      }
      await tx.inventoryMovement.create({
        data: {
          inventoryId: reservation.inventoryId, type: InventoryMovementType.SALE,
          quantityDelta: -reservation.quantity, referenceType: "ORDER", referenceId: order.id,
          idempotencyKey: `order:${order.id}:inventory:${reservation.inventoryId}`,
          note: `Inventory consumed for ${order.orderNumber}`, createdAt: now
        }
      });
      reservedByVariant.set(reservation.inventory.variantId, (reservedByVariant.get(reservation.inventory.variantId) ?? 0) + reservation.quantity);
    }
    for (const line of quote.lines) {
      if ((reservedByVariant.get(line.variantId) ?? 0) < line.quantity) {
        throw new Error("Inventory reservation does not cover every checkout line. The order was not placed.");
      }
    }

    for (const storeId of storeIds) {
      const lines = grouped.get(storeId)!;
      const vendorSubtotal = subtotalByStore.get(storeId)!;
      const vendorDiscount = discountByStore.get(storeId) ?? BigInt(0);
      const vendorShipping = shippingByStore.get(storeId)!;
      const vendorTax = allocatedTax.get(storeId) ?? BigInt(0);
      const vendorTotal = vendorSubtotal - vendorDiscount + vendorShipping + (quote.taxSnapshot.isInclusive ? BigInt(0) : vendorTax);
      const vendorOrder = await tx.vendorOrder.create({
        data: {
          orderId: order.id, storeId, status: VendorOrderStatus.PENDING_PAYMENT,
          subtotalMinor: vendorSubtotal, discountMinor: vendorDiscount, shippingMinor: vendorShipping, taxMinor: vendorTax,
          taxInclusive: quote.taxSnapshot.isInclusive,
          shippingServiceName: selections.get(storeId)!.serviceName, shippingRateId: selections.get(storeId)!.shippingRateId,
          shippingDestinationRegion: selections.get(storeId)!.destinationRegion,
          minDeliveryDays: selections.get(storeId)!.minDeliveryDays, maxDeliveryDays: selections.get(storeId)!.maxDeliveryDays,
          totalMinor: vendorTotal,
          statusHistory: { create: { status: VendorOrderStatus.PENDING_PAYMENT, note: "Awaiting payment; fulfillment is not yet authorized." } },
          items: { create: lines.map((line) => ({
            productId: line.variant.productId, variantId: line.variantId, productName: line.productName, sku: line.sku,
            variantName: line.variantName, quantity: line.quantity,
            unitAmountMinor: line.unitAmountMinor, lineTotalMinor: line.lineTotalMinor,
            commissionCategoryId: line.variant.product.categories[0]?.categoryId ?? null,
            commissionCategoryName: line.variant.product.categories[0]?.category.name ?? null
          })) }
        }
      });
      const storeOwner = await tx.store.findUniqueOrThrow({
        where: { id: storeId }, select: { name: true, seller: { select: { ownerId: true } } }
      });
      if (storeOwner.seller.ownerId !== ("userId" in owner ? owner.userId : "")) {
        await createInAppNotification(tx, {
          data: {
            userId: storeOwner.seller.ownerId, type: "SELLER_ORDER_RECEIVED",
            title: "New order for your store",
            message: `Order ${order.orderNumber} includes a new order for ${storeOwner.name}. It is awaiting payment.`,
            resourceType: "VENDOR_ORDER", resourceId: vendorOrder.id,
            deduplicationKey: `vendor-order:${vendorOrder.id}:seller:${storeOwner.seller.ownerId}`
          }
        });
      }
    }

    const converted = await tx.checkoutQuote.updateMany({
      where: { id: quote.id, status: CheckoutQuoteStatus.ACTIVE, expiresAt: { gt: now } },
      data: { status: CheckoutQuoteStatus.CONVERTED }
    });
    if (converted.count !== 1) throw new Error("Checkout quote expired or changed before order placement. Rebuild checkout.");
    const checkedOut = await tx.cart.updateMany({
      where: { id: quote.cartId, status: CartStatus.ACTIVE },
      data: { status: CartStatus.CHECKED_OUT }
    });
    if (checkedOut.count !== 1) throw new Error("Cart is no longer active. Refresh checkout before placing the order.");
    await tx.auditLog.create({
      data: {
        actorType: "SYSTEM", action: "order.created", resource: "order", resourceId: order.id,
        scopeType: "ORDER", scopeId: order.id, occurredAt: now,
        metadata: { orderNumber: order.orderNumber, vendorCount: storeIds.length, totalMinor: total.toString(), currencyCode: quote.currencyCode }
      }
    });

    const saved = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        currency: { select: { minorUnit: true, symbol: true } },
        address: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        payments: { select: { id: true, status: true } },
        vendorOrders: { orderBy: { createdAt: "asc" }, include: {
          store: { select: { id: true, name: true, slug: true } }, items: { orderBy: { createdAt: "asc" } },
          statusHistory: { orderBy: { createdAt: "asc" } },
          shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } }
        } }
      }
    });
    return serializeOrder(saved);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
      const committedOrder = await prisma.order.findFirst({
        where: { quoteId, ...ownerWhere(owner) },
        include: {
          currency: { select: { minorUnit: true, symbol: true } },
          address: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
          payments: { select: { id: true, status: true } },
          vendorOrders: { include: {
            store: { select: { id: true, name: true, slug: true } }, items: true,
            statusHistory: { orderBy: { createdAt: "asc" } },
            shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } }
          } }
        }
      });
      if (committedOrder) return serializeOrder(committedOrder);
      if (error.code === "P2034") throw new Error("Checkout changed concurrently. Retry placing the order.");
    }
    throw error;
  }
}

export async function getOwnedOrder(guestToken: string, orderId: string, now = new Date()) {
  // Reuse the same expiry/conversion policy used by payment, cancellation and reorder.
  const owner = await getOrderOwner(guestToken, now);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...ownerWhere(owner) },
    include: {
      currency: { select: { minorUnit: true, symbol: true } },
      address: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, status: true } },
      vendorOrders: { orderBy: { createdAt: "asc" }, include: {
        store: { select: { id: true, name: true, slug: true } }, items: { orderBy: { createdAt: "asc" } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } }
      } }
    }
  });
  if (!order) throw new Error("Order not found.");
  return serializeOrder(order);
}

export async function listCustomerOrders(now = new Date()) {
  const session = await getCurrentSession(now);
  if (!session) throw new Error("Sign in to view your order history.");
  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    orderBy: { placedAt: "desc" }, take: 50,
    include: {
      currency: { select: { minorUnit: true, symbol: true } },
      address: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, status: true } },
      vendorOrders: { orderBy: { createdAt: "asc" }, include: {
        store: { select: { id: true, name: true, slug: true } }, items: { orderBy: { createdAt: "asc" } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } }
      } }
    }
  });
  return orders.map(serializeOrder);
}

async function getOrderOwner(guestToken: string, now: Date): Promise<Owner> {
  const session = await getCurrentSession(now);
  if (session) return { userId: session.userId };
  const guest = await prisma.guestSession.findUnique({
    where: { tokenHash: hashToken(guestToken) },
    select: { id: true, expiresAt: true, convertedAt: true }
  });
  if (!guest || guest.expiresAt <= now || guest.convertedAt) throw new Error("Order not found.");
  return { guestSessionId: guest.id };
}

export async function cancelOwnedOrder(guestToken: string, orderId: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(orderId);
  const owner = await getOrderOwner(guestToken, now);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const order = await tx.order.findFirst({
      where: { id, ...ownerWhere(owner) },
      select: {
        id: true, orderNumber: true, status: true, userId: true,
        payments: { select: { id: true, status: true } },
        vendorOrders: { select: { id: true, status: true } }
      }
    });
    if (!order) throw new Error("Order not found.");
    if (order.status === OrderStatus.CANCELLED) return { id, status: OrderStatus.CANCELLED, changed: false };
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error("Only orders awaiting payment can be canceled.");
    }
    if (order.payments.some((payment) => payment.status !== PaymentStatus.FAILED && payment.status !== PaymentStatus.CANCELLED)) {
      throw new Error("An active or successful payment attempt exists for this order. Contact support to cancel it safely.");
    }
    if (order.vendorOrders.some((vendor) => vendor.status !== VendorOrderStatus.PENDING_PAYMENT)) {
      throw new Error("This order is no longer eligible for cancellation.");
    }

    const sales = await tx.inventoryMovement.findMany({
      where: { referenceType: "ORDER", referenceId: order.id, type: InventoryMovementType.SALE },
      select: { inventoryId: true, quantityDelta: true }
    });
    if (!sales.length || sales.some((sale) => sale.quantityDelta >= 0)) {
      throw new Error("Order inventory ledger is incomplete; contact support before canceling.");
    }
    for (const sale of sales) {
      const quantity = -sale.quantityDelta;
      const restored = await tx.inventory.updateMany({
        where: { id: sale.inventoryId },
        data: { quantityOnHand: { increment: quantity } }
      });
      if (restored.count !== 1) throw new Error("Order inventory could not be restored; contact support.");
      await tx.inventoryMovement.create({
        data: {
          inventoryId: sale.inventoryId, type: InventoryMovementType.ORDER_CANCELLATION,
          quantityDelta: quantity, referenceType: "ORDER_CANCELLATION", referenceId: order.id,
          idempotencyKey: `order-cancellation:${order.id}:${sale.inventoryId}`,
          note: `Inventory restored for canceled order ${order.orderNumber}`,
          createdById: "userId" in owner ? owner.userId : null, createdAt: now
        }
      });
    }

    const changed = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.CANCELLED }
    });
    if (changed.count !== 1) throw new Error("Order status changed concurrently; refresh and try again.");
    const canceledVendorOrders = await tx.vendorOrder.updateMany({
      where: { orderId: order.id, status: VendorOrderStatus.PENDING_PAYMENT },
      data: { status: VendorOrderStatus.CANCELLED }
    });
    if (canceledVendorOrders.count !== order.vendorOrders.length) {
      throw new Error("Seller order status changed while canceling; refresh and try again.");
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id, status: OrderStatus.CANCELLED,
        note: "Customer canceled after all payment attempts were absent or terminal; inventory was restored.",
        actorId: "userId" in owner ? owner.userId : null, createdAt: now
      }
    });
    for (const vendor of order.vendorOrders) {
      await tx.vendorOrderStatusHistory.create({
        data: {
          vendorOrderId: vendor.id, status: VendorOrderStatus.CANCELLED,
          note: "Parent order canceled before payment.", actorId: "userId" in owner ? owner.userId : null,
          createdAt: now
        }
      });
    }
    await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
    if (order.userId) {
      await createInAppNotification(tx, {
        data: {
          userId: order.userId, type: "ORDER_CANCELLED", title: "Order canceled",
          message: `Order ${order.orderNumber} was canceled and its inventory was released.`,
          resourceType: "ORDER", resourceId: order.id,
          deduplicationKey: `order:${order.id}:buyer:cancelled`
        }
      });
    }
    await tx.auditLog.create({
      data: {
        actorType: "userId" in owner ? "USER" : "SYSTEM",
        actorId: "userId" in owner ? owner.userId : null,
        action: "order.cancelled", resource: "order", resourceId: order.id,
        scopeType: "ORDER", scopeId: order.id, occurredAt: now,
        metadata: { orderNumber: order.orderNumber, inventoryMovementsReversed: sales.length }
      }
    });
    return { id, status: OrderStatus.CANCELLED, changed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reorderOwnedOrder(guestToken: string, orderId: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(orderId);
  const owner = await getOrderOwner(guestToken, now);
  const order = await prisma.order.findFirst({
    where: { id, ...ownerWhere(owner) },
    select: {
      marketId: true, currencyCode: true,
      vendorOrders: { select: { items: { select: { variantId: true, quantity: true } } } }
    }
  });
  if (!order) throw new Error("Order not found.");
  const items = order.vendorOrders.flatMap((vendor) => vendor.items)
    .filter((item): item is { variantId: string; quantity: number } => item.variantId !== null);
  if (!items.length) throw new Error("None of this order's product options are currently available to reorder.");
  return addCartItems(guestToken, {
    marketId: order.marketId, currencyCode: order.currencyCode, items
  }, now);
}
