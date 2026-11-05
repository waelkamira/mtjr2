import "server-only";

import { AuditActorType, PaymentStatus, Prisma, RefundStatus, ReturnItemStatus, ReturnRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/server/identity/permission-guard";

const createSchema = z.object({ returnRequestId: z.string().trim().min(1).max(128) }).strict();
const completeSchema = z.object({
  externalReference: z.string().trim().min(4).max(180),
  note: z.string().trim().max(1000).optional()
}).strict();

const refundablePaymentStatuses = [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED];
const committedRefundStatuses = [RefundStatus.PENDING_MANUAL, RefundStatus.COMPLETED];

function refundAmount(line: { quantity: number; orderItem: { quantity: number; lineTotalMinor: bigint } }) {
  if (line.quantity < 1 || line.quantity > line.orderItem.quantity || line.orderItem.quantity < 1) {
    throw new Error("A received return quantity is invalid for its original order line.");
  }
  return line.quantity === line.orderItem.quantity
    ? line.orderItem.lineTotalMinor
    : (line.orderItem.lineTotalMinor * BigInt(line.quantity)) / BigInt(line.orderItem.quantity);
}

/** Lists received return candidates and manual refunds for finance operators. */
export async function listRefundOperations(now = new Date()) {
  await requirePermission({ permissionKey: "payments:refund", now });
  const [requests, refunds] = await Promise.all([
    prisma.returnRequest.findMany({
      where: { status: ReturnRequestStatus.RECEIVED, refund: null, items: { some: { status: ReturnItemStatus.RECEIVED } } },
      orderBy: [{ reviewedAt: "asc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true, returnNumber: true,
        order: {
          select: {
            orderNumber: true, currencyCode: true, currency: { select: { minorUnit: true } },
            payments: {
              where: { status: { in: refundablePaymentStatuses } },
              select: { id: true, amountMinor: true, currencyCode: true, status: true }
            }
          }
        },
        items: {
          where: { status: ReturnItemStatus.RECEIVED },
          select: { quantity: true, orderItem: { select: { productName: true, sku: true, quantity: true, lineTotalMinor: true } } }
        }
      }
    }),
    prisma.refund.findMany({
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: 100,
      include: {
        order: { select: { orderNumber: true } },
        currency: { select: { minorUnit: true } },
        payment: { select: { status: true } },
        returnRequest: { select: { returnNumber: true } },
        items: { select: { quantity: true, amountMinor: true, returnItem: { select: { orderItem: { select: { productName: true, sku: true } } } } } }
      }
    })
  ]);

  return {
    candidates: requests.map((request) => {
      const amountMinor = request.items.reduce((sum, item) => sum + refundAmount(item), BigInt(0));
      const payment = request.order.payments.length === 1 ? request.order.payments[0] : null;
      const eligible = Boolean(payment && payment.currencyCode === request.order.currencyCode && amountMinor > BigInt(0) && amountMinor <= payment.amountMinor);
      return {
        returnRequestId: request.id,
        returnNumber: request.returnNumber,
        orderNumber: request.order.orderNumber,
        currencyCode: request.order.currencyCode,
        amountMinor: amountMinor.toString(),
        amountDisplay: new Intl.NumberFormat("en", { style: "currency", currency: request.order.currencyCode, minimumFractionDigits: request.order.currency.minorUnit, maximumFractionDigits: request.order.currency.minorUnit }).format(Number(amountMinor) / (10 ** request.order.currency.minorUnit)),
        eligible,
        reason: !payment ? "Exactly one successful captured payment is required." : amountMinor <= BigInt(0) ? "The refundable merchandise amount must be positive." : amountMinor > payment.amountMinor ? "The amount exceeds the captured payment." : null,
        items: request.items.map((item) => ({ productName: item.orderItem.productName, sku: item.orderItem.sku, quantity: item.quantity }))
      };
    }),
    refunds: refunds.map((refund) => ({
      id: refund.id,
      returnNumber: refund.returnRequest.returnNumber,
      orderNumber: refund.order.orderNumber,
      status: refund.status,
      paymentStatus: refund.payment.status,
      amountMinor: refund.amountMinor.toString(),
      currencyCode: refund.currencyCode,
      amountDisplay: new Intl.NumberFormat("en", { style: "currency", currency: refund.currencyCode, minimumFractionDigits: refund.currency.minorUnit, maximumFractionDigits: refund.currency.minorUnit }).format(Number(refund.amountMinor) / (10 ** refund.currency.minorUnit)),
      externalReference: refund.externalReference,
      note: refund.note,
      requestedAt: refund.requestedAt.toISOString(),
      completedAt: refund.completedAt?.toISOString() ?? null,
      items: refund.items.map((item) => ({ productName: item.returnItem.orderItem.productName, sku: item.returnItem.orderItem.sku, quantity: item.quantity, amountMinor: item.amountMinor.toString() }))
    }))
  };
}

/**
 * Creates a pending manual refund only for physically received return lines.
 * No provider is called and Payment.status remains unchanged until finance
 * records an external refund confirmation.
 */
export async function createManualRefundForReturn(input: unknown, now = new Date()) {
  const data = createSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "payments:refund", now });

  return prisma.$transaction(async (tx) => {
    const request = await tx.returnRequest.findUnique({
      where: { id: data.returnRequestId },
      select: {
        id: true, status: true, orderId: true,
        order: { select: { id: true, orderNumber: true, currencyCode: true } },
        items: {
          where: { status: ReturnItemStatus.RECEIVED },
          select: {
            id: true, quantity: true,
            orderItem: { select: { id: true, quantity: true, lineTotalMinor: true, productName: true, sku: true } }
          }
        }
      }
    });
    if (!request || request.status !== ReturnRequestStatus.RECEIVED || !request.items.length) {
      throw new Error("Only physically received return items can be refunded.");
    }

    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${request.orderId}, 0))`);

    const existing = await tx.refund.findUnique({ where: { returnRequestId: request.id } });
    if (existing) return { id: existing.id, status: existing.status, amountMinor: existing.amountMinor.toString(), alreadyApplied: true };

    const payments = await tx.payment.findMany({
      where: { orderId: request.orderId, status: { in: refundablePaymentStatuses } },
      orderBy: { succeededAt: "desc" },
      select: { id: true, amountMinor: true, currencyCode: true, status: true }
    });
    if (payments.length !== 1) throw new Error("Refund requires exactly one successful captured payment for this order.");
    const payment = payments[0];
    if (payment.currencyCode !== request.order.currencyCode) throw new Error("Payment and order currencies do not match.");

    const orderItemIds = [...new Set(request.items.map((item) => item.orderItem.id))];
    const previousAllocations = await tx.refundItem.findMany({
      where: {
        returnItem: { orderItemId: { in: orderItemIds } },
        refund: { paymentId: payment.id, status: { in: committedRefundStatuses } }
      },
      select: { quantity: true, amountMinor: true, returnItem: { select: { orderItemId: true } } }
    });
    const allocated = new Map<string, { quantity: number; amountMinor: bigint }>();
    for (const row of previousAllocations) {
      const current = allocated.get(row.returnItem.orderItemId) ?? { quantity: 0, amountMinor: BigInt(0) };
      current.quantity += row.quantity;
      current.amountMinor += row.amountMinor;
      allocated.set(row.returnItem.orderItemId, current);
    }

    const refundLines = request.items.map((item) => {
      const previous = allocated.get(item.orderItem.id) ?? { quantity: 0, amountMinor: BigInt(0) };
      const remainingQuantity = item.orderItem.quantity - previous.quantity;
      const remainingAmount = item.orderItem.lineTotalMinor - previous.amountMinor;
      if (item.quantity > remainingQuantity || remainingQuantity <= 0 || remainingAmount <= 0) {
        throw new Error("The return line has no refundable merchandise balance remaining.");
      }
      const amountMinor = item.quantity === remainingQuantity
        ? remainingAmount
        : (remainingAmount * BigInt(item.quantity)) / BigInt(remainingQuantity);
      if (amountMinor <= 0) throw new Error("The return line produces no positive minor-unit refund amount.");
      return { returnItemId: item.id, quantity: item.quantity, amountMinor };
    });
    const amountMinor = refundLines.reduce((sum, line) => sum + line.amountMinor, BigInt(0));
    if (amountMinor <= 0) throw new Error("The refundable merchandise amount must be positive.");

    const committed = await tx.refund.aggregate({
      where: { paymentId: payment.id, status: { in: committedRefundStatuses } },
      _sum: { amountMinor: true }
    });
    const alreadyCommitted = committed._sum.amountMinor ?? BigInt(0);
    if (alreadyCommitted + amountMinor > payment.amountMinor) {
      throw new Error("Refund would exceed the captured payment balance.");
    }

    const refund = await tx.refund.create({
      data: {
        orderId: request.orderId,
        paymentId: payment.id,
        returnRequestId: request.id,
        currencyCode: payment.currencyCode,
        amountMinor,
        idempotencyKey: `return-refund:${request.id}`,
        requestedById: actor.userId,
        note: "Manual merchandise refund requested after physical return receipt.",
        items: { create: refundLines }
      },
      select: { id: true, status: true, amountMinor: true }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "refund.manual_requested", resource: "refund", resourceId: refund.id,
        scopeType: "ORDER", scopeId: request.orderId, occurredAt: now,
        metadata: { returnRequestId: request.id, amountMinor: amountMinor.toString(), currencyCode: payment.currencyCode, itemCount: refundLines.length, providerAction: "NONE_MANUAL_PROCESSING_REQUIRED" }
      }
    });

    return { id: refund.id, status: refund.status, amountMinor: refund.amountMinor.toString(), alreadyApplied: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Confirms a refund only after an operator has completed it outside the platform. */
export async function completeManualRefund(refundIdInput: string, input: unknown, now = new Date()) {
  const refundId = z.string().trim().min(1).max(128).parse(refundIdInput);
  const data = completeSchema.parse(input);
  const actor = await requirePermission({ permissionKey: "payments:refund", now });

  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      select: { id: true, orderId: true, paymentId: true, amountMinor: true, status: true, externalReference: true, payment: { select: { amountMinor: true, status: true } } }
    });
    if (!refund) throw new Error("Refund not found.");
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${refund.orderId}, 0))`);

    if (refund.status === RefundStatus.COMPLETED) {
      if (refund.externalReference === data.externalReference) {
        return { id: refund.id, status: refund.status, alreadyApplied: true };
      }
      throw new Error("This refund was already completed with a different external reference.");
    }
    if (refund.status !== RefundStatus.PENDING_MANUAL) throw new Error("Only pending manual refunds can be completed.");
    if (![PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED].includes(refund.payment.status)) {
      throw new Error("The payment is not in a refundable state; reconcile it before completion.");
    }

    const completedBefore = await tx.refund.aggregate({
      where: { paymentId: refund.paymentId, status: RefundStatus.COMPLETED },
      _sum: { amountMinor: true }
    });
    const totalAfter = (completedBefore._sum.amountMinor ?? BigInt(0)) + refund.amountMinor;
    if (totalAfter > refund.payment.amountMinor) throw new Error("Completed refunds would exceed the captured payment.");

    const changed = await tx.refund.updateMany({
      where: { id: refund.id, status: RefundStatus.PENDING_MANUAL },
      data: { status: RefundStatus.COMPLETED, externalReference: data.externalReference, note: data.note || null, completedAt: now, completedById: actor.userId }
    });
    if (changed.count !== 1) throw new Error("The refund changed. Refresh and try again.");

    const nextPaymentStatus = totalAfter >= refund.payment.amountMinor ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    const paymentChanged = await tx.payment.updateMany({
      where: { id: refund.paymentId, status: { in: refundablePaymentStatuses } },
      data: { status: nextPaymentStatus }
    });
    if (paymentChanged.count !== 1) throw new Error("The payment changed during refund completion; retry after reconciliation.");

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "refund.manual_completed", resource: "refund", resourceId: refund.id,
        scopeType: "ORDER", scopeId: refund.orderId, occurredAt: now,
        metadata: { amountMinor: refund.amountMinor.toString(), externalReference: data.externalReference, paymentStatus: nextPaymentStatus, providerAction: "MANUALLY_CONFIRMED_EXTERNAL" }
      }
    });
    return { id: refund.id, status: RefundStatus.COMPLETED, paymentStatus: nextPaymentStatus, alreadyApplied: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
