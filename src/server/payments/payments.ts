import "server-only";

import { createHash } from "node:crypto";
import { PaymentStatus, OrderStatus, VendorOrderStatus, Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { getPaymentProvider } from "./providers/registry";
import type { VerifiedPaymentEvent } from "./providers/types";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type Owner = { userId: string } | { guestSessionId: string };
function ownerWhere(owner: Owner) {
  return "userId" in owner ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId };
}

function serializePayment(payment: {
  id: string; orderId: string; provider: string; status: PaymentStatus; amountMinor: bigint;
  currencyCode: string; checkoutUrl: string | null; expiresAt: Date | null;
}) {
  return {
    id: payment.id, orderId: payment.orderId, provider: payment.provider, status: payment.status,
    amountMinor: payment.amountMinor.toString(), currencyCode: payment.currencyCode,
    checkoutUrl: payment.checkoutUrl, expiresAt: payment.expiresAt?.toISOString() ?? null
  };
}

export async function startOrderPayment(input: {
  guestToken: string; orderId: string; providerKey: string; idempotencyKey: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const provider = getPaymentProvider(input.providerKey);
  if (!provider) throw new Error("This payment provider is not configured for the platform.");

  const session = await getCurrentSession(now);
  const owner: Owner = session
    ? { userId: session.userId }
    : await prisma.guestSession.findUnique({
        where: { tokenHash: hashToken(input.guestToken) },
        select: { id: true, expiresAt: true, convertedAt: true }
      }).then((guest) => {
        if (!guest || guest.expiresAt <= now || guest.convertedAt) throw new Error("Checkout session expired. Sign in or return to your order.");
        return { guestSessionId: guest.id };
      });

  const order = await prisma.order.findFirst({
    where: { id: input.orderId, ...ownerWhere(owner) },
    select: { id: true, orderNumber: true, status: true, totalMinor: true, currencyCode: true }
  });
  if (!order) throw new Error("Order not found.");
  if (order.status !== OrderStatus.PENDING_PAYMENT) throw new Error("This order is not awaiting payment.");
  if (order.totalMinor <= BigInt(0)) throw new Error("A zero-value order does not require a payment.");

  const payment = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${order.id}, 0))`);
    const currentOrder = await tx.order.findFirst({
      where: { id: order.id, ...ownerWhere(owner), status: OrderStatus.PENDING_PAYMENT },
      select: { id: true }
    });
    if (!currentOrder) throw new Error("This order is no longer awaiting payment.");
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.orderId !== order.id || existing.provider !== provider.key) {
        throw new Error("The payment idempotency key is already used for another request.");
      }
      return existing;
    }
    const active = await tx.payment.findFirst({
      where: { orderId: order.id, status: { in: [PaymentStatus.INITIATING, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] } },
      orderBy: { createdAt: "desc" }
    });
    if (active) {
      if (active.provider !== provider.key) throw new Error("A payment attempt is already active with another provider. Complete or cancel it before switching methods.");
      return active;
    }
    return tx.payment.create({
      data: {
        orderId: order.id, provider: provider.key, amountMinor: order.totalMinor,
        currencyCode: order.currencyCode, idempotencyKey: input.idempotencyKey,
        status: PaymentStatus.INITIATING
      }
    });
  });

  if (payment.status !== PaymentStatus.INITIATING || payment.checkoutUrl) return serializePayment(payment);

  try {
    const returnUrl = new URL(`/orders/${encodeURIComponent(order.id)}`, env.NEXT_PUBLIC_APP_URL).toString();
    const intent = await provider.createIntent({
      paymentId: payment.id, orderNumber: order.orderNumber, amountMinor: order.totalMinor.toString(),
      currencyCode: order.currencyCode, idempotencyKey: payment.idempotencyKey, returnUrl,
      metadata: { orderId: order.id, paymentId: payment.id }
    });
    const checkoutUrl = new URL(intent.checkoutUrl);
    if (checkoutUrl.protocol !== "https:") throw new Error("Payment provider returned an insecure checkout URL.");
    if (!intent.providerReference.trim()) throw new Error("Payment provider returned an empty reference.");
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerReference: intent.providerReference, checkoutUrl: checkoutUrl.toString(),
        expiresAt: intent.expiresAt ?? null, status: PaymentStatus.REQUIRES_ACTION,
        failureCode: null, failureMessage: null
      }
    });
    return serializePayment(updated);
  } catch (error) {
    // Keep the attempt INITIATING: a network timeout can happen after the provider
    // created its intent. Retrying must reuse the same provider idempotency key.
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATING },
      data: { failureCode: "PROVIDER_RESPONSE_UNCERTAIN", failureMessage: "Payment session is being reconciled. Retry safely." }
    });
    throw error;
  }
}

export async function processVerifiedPaymentEvent(input: {
  providerKey: string; event: VerifiedPaymentEvent; payloadHash: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const initialPayment = await tx.payment.findUnique({
        where: { provider_providerReference: { provider: input.providerKey, providerReference: input.event.providerReference } },
        select: { id: true, orderId: true }
      });
      if (!initialPayment) throw new Error("Payment reference was not found.");
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${initialPayment.orderId}, 0))`);
      const payment = await tx.payment.findUnique({
        where: { id: initialPayment.id },
        include: { order: { include: { vendorOrders: { include: { store: { include: { seller: { select: { ownerId: true } } } } } } } }
      });
      if (!payment) throw new Error("Payment reference was not found.");
      if (payment.amountMinor.toString() !== input.event.amountMinor || payment.currencyCode !== input.event.currencyCode) {
        throw new Error("Verified payment amount or currency does not match the order.");
      }
      const recorded = await tx.paymentWebhookEvent.create({
        data: {
          provider: input.providerKey, providerEventId: input.event.eventId, eventType: input.event.eventType,
          paymentId: payment.id, payloadHash: input.payloadHash, receivedAt: now
        }
      });

      const isNewerEvent = !payment.lastProviderEventAt || input.event.occurredAt > payment.lastProviderEventAt;
      let nextStatus = payment.status;
      if (isNewerEvent) {
        if (input.event.eventType === "succeeded") nextStatus = PaymentStatus.SUCCEEDED;
        else if (payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.FAILED && payment.status !== PaymentStatus.CANCELLED) {
          if (input.event.eventType === "processing") nextStatus = PaymentStatus.PROCESSING;
          else if (input.event.eventType === "failed") nextStatus = PaymentStatus.FAILED;
          else if (input.event.eventType === "cancelled") nextStatus = PaymentStatus.CANCELLED;
        }
      }

      const duplicateSuccessfulPayment = isNewerEvent && nextStatus === PaymentStatus.SUCCEEDED
        && payment.status !== PaymentStatus.SUCCEEDED && payment.order.status !== OrderStatus.PENDING_PAYMENT;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: duplicateSuccessfulPayment ? PaymentStatus.DISPUTED : nextStatus,
          succeededAt: nextStatus === PaymentStatus.SUCCEEDED ? (payment.succeededAt ?? input.event.occurredAt) : payment.succeededAt,
          failureCode: nextStatus === PaymentStatus.FAILED ? "PROVIDER_PAYMENT_FAILED" : duplicateSuccessfulPayment ? "ORDER_ALREADY_PAID" : null,
          failureMessage: nextStatus === PaymentStatus.FAILED ? "The payment provider reported a failed payment." : duplicateSuccessfulPayment ? "A successful payment arrived after this order was already confirmed or cancelled. Manual reconciliation is required." : null,
          lastProviderEventAt: isNewerEvent ? input.event.occurredAt : payment.lastProviderEventAt
        }
      });

      if (duplicateSuccessfulPayment) {
        await tx.paymentWebhookEvent.update({
          where: { id: recorded.id },
          data: { processedAt: now, processingError: "Order already has a terminal state; duplicate successful collection requires manual reconciliation." }
        });
        await tx.auditLog.create({
          data: {
            actorType: "SYSTEM", action: "payment.duplicate_success_requires_reconciliation",
            resource: "payment", resourceId: payment.id, scopeType: "ORDER", scopeId: payment.orderId,
            occurredAt: now, metadata: { provider: input.providerKey, providerEventId: input.event.eventId, orderStatus: payment.order.status }
          }
        });
        return { accepted: true, duplicate: false, paymentId: payment.id, status: PaymentStatus.DISPUTED, requiresReconciliation: true };
      }

      if (isNewerEvent && nextStatus === PaymentStatus.SUCCEEDED && payment.order.status === OrderStatus.PENDING_PAYMENT) {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.CONFIRMED } });
        await tx.orderStatusHistory.create({
          data: { orderId: payment.orderId, status: OrderStatus.CONFIRMED, note: "Payment confirmed by a verified provider event.", createdAt: now }
        });
        for (const vendor of payment.order.vendorOrders) {
          await tx.vendorOrder.update({ where: { id: vendor.id }, data: { status: VendorOrderStatus.CONFIRMED } });
          await tx.vendorOrderStatusHistory.create({
            data: { vendorOrderId: vendor.id, status: VendorOrderStatus.CONFIRMED, note: "Payment confirmed by a verified provider event.", createdAt: now }
          });
          await tx.notification.create({
            data: {
              userId: vendor.store.seller.ownerId, type: "SELLER_PAYMENT_CONFIRMED",
              title: "Payment confirmed for a new order",
              message: `Payment for order ${payment.order.orderNumber} is confirmed. Your store can begin order processing.`,
              resourceType: "VENDOR_ORDER", resourceId: vendor.id,
              deduplicationKey: `payment:${payment.id}:vendor-order:${vendor.id}:confirmed`
            }
          });
        }
        if (payment.order.userId) {
          await tx.notification.create({
            data: {
              userId: payment.order.userId, type: "ORDER_PAYMENT_CONFIRMED",
              title: "Your payment is confirmed",
              message: `Payment for order ${payment.order.orderNumber} was confirmed.`,
              resourceType: "ORDER", resourceId: payment.orderId,
              deduplicationKey: `payment:${payment.id}:order:${payment.orderId}:confirmed`
            }
          });
        }
        await tx.auditLog.create({
          data: {
            actorType: "SYSTEM", action: "payment.confirmed", resource: "payment", resourceId: payment.id,
            scopeType: "ORDER", scopeId: payment.orderId, occurredAt: now,
            metadata: { provider: input.providerKey, providerEventId: input.event.eventId, amountMinor: payment.amountMinor.toString(), currencyCode: payment.currencyCode }
          }
        });
      }

      await tx.paymentWebhookEvent.update({ where: { id: recorded.id }, data: { processedAt: now } });
      return { accepted: true, duplicate: false, paymentId: payment.id, status: nextStatus };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingEvent = await prisma.paymentWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider: input.providerKey, providerEventId: input.event.eventId } },
        select: { payloadHash: true }
      });
      if (existingEvent) {
        if (existingEvent.payloadHash !== input.payloadHash) {
          throw new Error("The provider reused an event ID with a different payload.");
        }
        return { accepted: true, duplicate: true };
      }
    }
    throw error;
  }
}

export async function listAvailablePaymentProviders() {
  const { listPaymentProviders } = await import("./providers/registry");
  return listPaymentProviders();
}
