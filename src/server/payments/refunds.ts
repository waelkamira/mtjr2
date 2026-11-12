import "server-only";

import { AuditActorType, PaymentStatus, Prisma, RefundStatus, ReturnItemStatus, ReturnRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PermissionDeniedError, requirePermission } from "@/server/identity/permission-guard";
import { getPaymentProviderRuntimeSnapshot } from "@/server/admin/payment-providers";
import { allocateDiscountAcrossLines } from "@/server/admin/commission-policy";
import { paypalPaymentProvider } from "@/server/payments/providers/paypal";
import { stripePaymentProvider } from "@/server/payments/providers/stripe";

const createSchema = z.object({ returnRequestId: z.string().trim().min(1).max(128) }).strict();
const completeSchema = z.object({
  externalReference: z.string().trim().min(4).max(180),
  note: z.string().trim().max(1000).optional()
}).strict();

const refundablePaymentStatuses = [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED];
const committedRefundStatuses = [RefundStatus.PENDING_MANUAL, RefundStatus.PROCESSING_PROVIDER, RefundStatus.PROVIDER_FAILED, RefundStatus.COMPLETED];

type RefundVendorOrderSnapshot = {
  id: string;
  subtotalMinor: bigint;
  discountMinor: bigint;
  items: Array<{ id: string; lineTotalMinor: bigint }>;
};

/** Reuses checkout's deterministic vendor-level discount allocation for refund bases. */
function buildNetMerchandiseBases(vendorOrders: Iterable<RefundVendorOrderSnapshot>) {
  const bases = new Map<string, bigint>();
  for (const vendorOrder of vendorOrders) {
    const itemSubtotal = vendorOrder.items.reduce((sum, item) => sum + item.lineTotalMinor, BigInt(0));
    if (itemSubtotal !== vendorOrder.subtotalMinor) {
      throw new Error("Vendor order item totals do not match the saved merchandise subtotal.");
    }
    for (const [itemId, amount] of allocateDiscountAcrossLines(
      vendorOrder.items,
      vendorOrder.discountMinor
    )) {
      bases.set(itemId, amount);
    }
  }
  return bases;
}

function displayAmount(amountMinor: bigint, currencyCode: string, minorUnit: number) {
  const scale = BigInt(10) ** BigInt(minorUnit);
  const whole = amountMinor / scale;
  const fraction = minorUnit ? (amountMinor % scale).toString().padStart(minorUnit, "0") : "";
  return `${currencyCode} ${new Intl.NumberFormat("en").format(whole)}${minorUnit ? "." + fraction : ""}`;
}

/** Lists received return candidates and refund operations for finance operators. */
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
              select: { id: true, amountMinor: true, currencyCode: true, status: true, provider: true }
            }
          }
        },
        items: {
          where: { status: ReturnItemStatus.RECEIVED },
          select: {
            quantity: true,
            orderItem: {
              select: {
                id: true, productName: true, sku: true, quantity: true,
                vendorOrder: {
                  select: {
                    id: true, subtotalMinor: true, discountMinor: true,
                    items: { select: { id: true, lineTotalMinor: true } }
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.refund.findMany({
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: 100,
      include: {
        order: { select: { orderNumber: true } },
        currency: { select: { minorUnit: true } },
        payment: { select: { status: true, provider: true } },
        returnRequest: { select: { returnNumber: true } },
        items: { select: { quantity: true, amountMinor: true, returnItem: { select: { orderItem: { select: { productName: true, sku: true } } } } } }
      }
    })
  ]);

  const vendorOrderSnapshots = new Map<string, RefundVendorOrderSnapshot>();
  for (const request of requests) {
    for (const item of request.items) vendorOrderSnapshots.set(item.orderItem.vendorOrder.id, item.orderItem.vendorOrder);
  }
  const netMerchandiseBases = buildNetMerchandiseBases(vendorOrderSnapshots.values());
  const orderItemIds = [...new Set(requests.flatMap((request) => request.items.map((item) => item.orderItem.id)))];
  const paymentIds = [...new Set(requests.flatMap((request) => request.order.payments.map((payment) => payment.id)))];
  const [previousAllocations, committedRefunds] = await Promise.all([
    orderItemIds.length ? prisma.refundItem.findMany({
      where: { returnItem: { orderItemId: { in: orderItemIds } }, refund: { status: { in: committedRefundStatuses } } },
      select: { quantity: true, amountMinor: true, returnItem: { select: { orderItemId: true } } }
    }) : [],
    paymentIds.length ? prisma.refund.findMany({
      where: { paymentId: { in: paymentIds }, status: { in: committedRefundStatuses } },
      select: { paymentId: true, amountMinor: true }
    }) : []
  ]);
  const allocationByOrderItem = new Map<string, { quantity: number; amountMinor: bigint }>();
  for (const row of previousAllocations) {
    const current = allocationByOrderItem.get(row.returnItem.orderItemId) ?? { quantity: 0, amountMinor: BigInt(0) };
    current.quantity += row.quantity;
    current.amountMinor += row.amountMinor;
    allocationByOrderItem.set(row.returnItem.orderItemId, current);
  }
  const committedByPayment = new Map<string, bigint>();
  for (const refund of committedRefunds) committedByPayment.set(refund.paymentId, (committedByPayment.get(refund.paymentId) ?? BigInt(0)) + refund.amountMinor);

  return {
    candidates: requests.map((request) => {
      const allocationsValid = request.items.every((item) => {
        const previous = allocationByOrderItem.get(item.orderItem.id) ?? { quantity: 0, amountMinor: BigInt(0) };
        const netLineAmount = netMerchandiseBases.get(item.orderItem.id);
        return netLineAmount !== undefined &&
          item.quantity <= item.orderItem.quantity - previous.quantity &&
          netLineAmount > previous.amountMinor;
      });
      const amountMinor = request.items.reduce((sum, item) => {
        const previous = allocationByOrderItem.get(item.orderItem.id) ?? { quantity: 0, amountMinor: BigInt(0) };
        const remainingQuantity = item.orderItem.quantity - previous.quantity;
        const netLineAmount = netMerchandiseBases.get(item.orderItem.id) ?? BigInt(0);
        const remainingAmount = netLineAmount - previous.amountMinor;
        if (remainingQuantity <= 0 || item.quantity > remainingQuantity) return sum;
        const lineAmount = item.quantity === remainingQuantity ? remainingAmount : (remainingAmount * BigInt(item.quantity)) / BigInt(remainingQuantity);
        return sum + lineAmount;
      }, BigInt(0));
      const payment = request.order.payments.length === 1 ? request.order.payments[0] : null;
      const paymentRemaining = payment ? payment.amountMinor - (committedByPayment.get(payment.id) ?? BigInt(0)) : BigInt(0);
      const eligible = Boolean(payment && payment.currencyCode === request.order.currencyCode && allocationsValid && amountMinor > BigInt(0) && amountMinor <= paymentRemaining);
      return {
        returnRequestId: request.id,
        returnNumber: request.returnNumber,
        orderNumber: request.order.orderNumber,
        currencyCode: request.order.currencyCode,
        provider: payment?.provider ?? null,
        amountMinor: amountMinor.toString(),
        amountDisplay: displayAmount(amountMinor, request.order.currencyCode, request.order.currency.minorUnit),
        eligible,
        reason: !payment ? "Exactly one successful captured payment is required." : !allocationsValid ? "Returned quantities or remaining line value have already been allocated." : amountMinor <= BigInt(0) ? "The refundable merchandise amount must be positive." : amountMinor > paymentRemaining ? "The amount exceeds the remaining captured payment balance." : null,
        items: request.items.map((item) => ({ productName: item.orderItem.productName, sku: item.orderItem.sku, quantity: item.quantity }))
      };
    }),
    refunds: refunds.map((refund) => ({
      id: refund.id,
      returnNumber: refund.returnRequest.returnNumber,
      orderNumber: refund.order.orderNumber,
      status: refund.status,
      paymentStatus: refund.payment.status,
      provider: refund.payment.provider,
      amountMinor: refund.amountMinor.toString(),
      currencyCode: refund.currencyCode,
      amountDisplay: displayAmount(refund.amountMinor, refund.currencyCode, refund.currency.minorUnit),
      externalReference: refund.externalReference,
      note: refund.note,
      requestedAt: refund.requestedAt.toISOString(),
      completedAt: refund.completedAt?.toISOString() ?? null,
      items: refund.items.map((item) => ({ productName: item.returnItem.orderItem.productName, sku: item.returnItem.orderItem.sku, quantity: item.quantity, amountMinor: item.amountMinor.toString() }))
    }))
  };
}

/**
 * Creates a pending refund request only for physically received return lines.
 * No provider is called here; a second finance operator explicitly executes it.
 */
export async function createRefundForReturn(input: unknown, now = new Date()) {
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
            orderItem: {
               select: {
                 id: true, quantity: true, productName: true, sku: true,
                 vendorOrder: {
                   select: {
                     id: true, subtotalMinor: true, discountMinor: true,
                     items: { select: { id: true, lineTotalMinor: true } }
                   }
                 }
               }
             }
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

    const vendorOrderSnapshots = new Map<string, RefundVendorOrderSnapshot>();
    for (const item of request.items) vendorOrderSnapshots.set(item.orderItem.vendorOrder.id, item.orderItem.vendorOrder);
    const netMerchandiseBases = buildNetMerchandiseBases(vendorOrderSnapshots.values());

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
      const netLineAmount = netMerchandiseBases.get(item.orderItem.id);
      if (netLineAmount === undefined) throw new Error("Refund merchandise allocation is incomplete.");
      const remainingAmount = netLineAmount - previous.amountMinor;
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
        note: "Merchandise refund requested after physical return receipt.",
        items: { create: refundLines }
      },
      select: { id: true, status: true, amountMinor: true }
    });

    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "refund.requested", resource: "refund", resourceId: refund.id,
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
      select: { id: true, orderId: true, paymentId: true, amountMinor: true, status: true, externalReference: true, requestedById: true, payment: { select: { amountMinor: true, status: true } } }
    });
    if (!refund) throw new Error("Refund not found.");
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${refund.orderId}, 0))`);

    if (refund.status === RefundStatus.COMPLETED) {
      if (refund.externalReference === data.externalReference) {
        return { id: refund.id, status: refund.status, alreadyApplied: true };
      }
      throw new Error("This refund was already completed with a different external reference.");
    }
    if (refund.status !== RefundStatus.PENDING_MANUAL && refund.status !== RefundStatus.PROVIDER_FAILED) throw new Error("Only pending or provider-failed refunds can be manually completed after external reconciliation.");
    if (refund.requestedById === actor.userId) throw new PermissionDeniedError("A different finance operator must confirm a refund requested by this account.");
    if (refund.payment.status !== PaymentStatus.SUCCEEDED && refund.payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new Error("The payment is not in a refundable state; reconcile it before completion.");
    }

    const committedBefore = await tx.refund.aggregate({
      where: { paymentId: refund.paymentId, status: { in: committedRefundStatuses }, id: { not: refund.id } },
      _sum: { amountMinor: true }
    });
    const totalAfter = (committedBefore._sum.amountMinor ?? BigInt(0)) + refund.amountMinor;
    if (totalAfter > refund.payment.amountMinor) throw new Error("Completed refunds would exceed the captured payment.");

    const changed = await tx.refund.updateMany({
      where: { id: refund.id, status: { in: [RefundStatus.PENDING_MANUAL, RefundStatus.PROVIDER_FAILED] } },
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


function refundAdapter(provider: string) {
  if (provider === "paypal") return paypalPaymentProvider;
  if (provider === "stripe") return stripePaymentProvider;
  throw new Error("Automatic refunds are not supported for this payment provider.");
}

async function finalizeProviderRefund(refundId: string, providerRefundReference: string, actorId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true, orderId: true, paymentId: true, amountMinor: true, status: true,
        payment: { select: { amountMinor: true, status: true } }
      }
    });
    if (!refund) throw new Error("Refund not found.");
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${refund.orderId}, 0))`);
    if (refund.status === RefundStatus.COMPLETED) return { id: refund.id, status: refund.status, alreadyApplied: true };
    if (refund.status !== RefundStatus.PROCESSING_PROVIDER && refund.status !== RefundStatus.PROVIDER_FAILED) throw new Error("The provider refund is no longer in a reconcilable state.");

    const committedBefore = await tx.refund.aggregate({
      where: { paymentId: refund.paymentId, status: { in: committedRefundStatuses }, id: { not: refund.id } },
      _sum: { amountMinor: true }
    });
    const totalAfter = (committedBefore._sum.amountMinor ?? 0n) + refund.amountMinor;
    if (totalAfter > refund.payment.amountMinor) throw new Error("Completed provider refunds would exceed the captured payment.");

    const changed = await tx.refund.updateMany({
      where: { id: refund.id, status: { in: [RefundStatus.PROCESSING_PROVIDER, RefundStatus.PROVIDER_FAILED] } },
      data: {
        status: RefundStatus.COMPLETED,
        externalReference: providerRefundReference,
        completedAt: now,
        completedById: actorId
      }
    });
    if (changed.count !== 1) throw new Error("The refund changed while finalizing the provider result.");
    const nextPaymentStatus = totalAfter >= refund.payment.amountMinor ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    const paymentChanged = await tx.payment.updateMany({
      where: { id: refund.paymentId, status: { in: refundablePaymentStatuses } },
      data: { status: nextPaymentStatus }
    });
    if (paymentChanged.count !== 1) throw new Error("The payment changed during provider refund finalization; reconcile it before retrying.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId,
        action: "refund.provider_completed", resource: "refund", resourceId: refund.id,
        scopeType: "ORDER", scopeId: refund.orderId, occurredAt: now,
        metadata: { amountMinor: refund.amountMinor.toString(), providerRefundReference, paymentStatus: nextPaymentStatus, providerAction: "PROVIDER_API_CONFIRMED" }
      }
    });
    return { id: refund.id, status: RefundStatus.COMPLETED, paymentStatus: nextPaymentStatus, alreadyApplied: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Sends an explicitly requested, finance-authorized refund to the original provider. */
export async function executeProviderRefund(refundIdInput: string, now = new Date()) {
  const refundId = z.string().trim().min(1).max(128).parse(refundIdInput);
  const actor = await requirePermission({ permissionKey: "payments:refund", now });
  const claim = await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true, orderId: true, paymentId: true, amountMinor: true, currencyCode: true,
        status: true, externalReference: true, providerSubmittedAt: true, providerAttempt: true, requestedById: true, payment: {
          select: {
            provider: true, providerReference: true, providerConfigId: true,
            providerEnvironment: true, amountMinor: true, status: true
          }
        }
      }
    });
    if (!refund) throw new Error("Refund not found.");
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${refund.orderId}, 0))`);
    if (refund.status === RefundStatus.COMPLETED) return { done: true as const, id: refund.id };
    if (refund.requestedById === actor.userId) throw new PermissionDeniedError("A different finance operator must execute a refund requested by this account.");
    if (refund.status === RefundStatus.PROCESSING_PROVIDER && refund.externalReference) return { processing: true as const, id: refund.id, reference: refund.externalReference };
    if (refund.status === RefundStatus.PROVIDER_FAILED && refund.externalReference) throw new Error("A provider refund reference already exists. Refresh its status or reconcile it manually instead of submitting another refund.");
    if (refund.status !== RefundStatus.PENDING_MANUAL && refund.status !== RefundStatus.PROVIDER_FAILED && refund.status !== RefundStatus.PROCESSING_PROVIDER) {
      throw new Error("Only pending or retryable provider-failed refunds can be submitted.");
    }
    if (refund.providerSubmittedAt) {
      const retentionMs = refund.payment.provider === "paypal" ? 44 * 24 * 60 * 60 * 1000 : 23 * 60 * 60 * 1000;
      if (now.getTime() - refund.providerSubmittedAt.getTime() > retentionMs) throw new Error("The provider idempotency retention window has expired. Reconcile the provider dashboard and record the confirmed outcome manually; automatic retry is blocked to prevent a duplicate refund.");
    }
    if (!refund.payment.providerReference) throw new Error("The original payment has no provider transaction reference.");
    if (refund.payment.status !== PaymentStatus.SUCCEEDED && refund.payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new Error("The original payment is not in a refundable state.");
    }
    const completedOrReserved = await tx.refund.aggregate({
      where: { paymentId: refund.paymentId, status: { in: committedRefundStatuses }, id: { not: refund.id } },
      _sum: { amountMinor: true }
    });
    if ((completedOrReserved._sum.amountMinor ?? 0n) + refund.amountMinor > refund.payment.amountMinor) {
      throw new Error("This refund and other committed refunds exceed the captured payment balance.");
    }
    const changed = await tx.refund.updateMany({
      where: { id: refund.id, status: refund.status },
      data: { status: RefundStatus.PROCESSING_PROVIDER, providerSubmittedAt: refund.providerSubmittedAt ?? now }
    });
    if (changed.count !== 1) throw new Error("The refund changed. Refresh and try again.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "refund.provider_submitted", resource: "refund", resourceId: refund.id,
        scopeType: "ORDER", scopeId: refund.orderId, occurredAt: now,
        metadata: { amountMinor: refund.amountMinor.toString(), provider: refund.payment.provider, providerAction: "PROVIDER_API_REQUESTED" }
      }
    });
    return {
      done: false as const, processing: false as const, id: refund.id, providerAttempt: refund.providerAttempt,
      provider: refund.payment.provider, paymentId: refund.paymentId, providerReference: refund.payment.providerReference,
      amountMinor: refund.amountMinor.toString(), currencyCode: refund.currencyCode,
      providerConfigId: refund.payment.providerConfigId,
      providerEnvironment: refund.payment.providerEnvironment
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if ("done" in claim && claim.done) return { id: claim.id, status: RefundStatus.COMPLETED, alreadyApplied: true };
  if ("processing" in claim && claim.processing) return { id: claim.id, status: RefundStatus.PROCESSING_PROVIDER, alreadyApplied: true };

  try {
    const adapter = refundAdapter(claim.provider);
    const snapshot = await getPaymentProviderRuntimeSnapshot(claim.paymentId);
    if (claim.providerConfigId && !snapshot) throw new Error("The managed payment credential snapshot is unavailable; automatic refund is blocked.");
    if (snapshot && snapshot.provider !== claim.provider) throw new Error("The stored provider snapshot does not match the payment provider.");
    const result = await adapter.createRefund({
      providerReference: claim.providerReference,
      amountMinor: claim.amountMinor,
      currencyCode: claim.currencyCode,
      idempotencyKey: `matjar-refund-${claim.id}-${claim.providerAttempt}`,
      refundId: claim.id,
      paymentId: claim.paymentId,
      providerCredentials: snapshot?.credentials,
      providerEnvironment: snapshot?.environment
    });
    if (result.status === "COMPLETED") return finalizeProviderRefund(claim.id, result.providerRefundReference, actor.userId, now);
    await prisma.refund.updateMany({
      where: { id: claim.id, status: RefundStatus.PROCESSING_PROVIDER },
      data: { externalReference: result.providerRefundReference, ...(result.status === "FAILED" ? { status: RefundStatus.PROVIDER_FAILED } : {}) }
    });
    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: result.status === "PROCESSING" ? "refund.provider_pending" : "refund.provider_failed",
        resource: "refund", resourceId: claim.id, scopeType: "ORDER",
        scopeId: (await prisma.refund.findUniqueOrThrow({ where: { id: claim.id }, select: { orderId: true } })).orderId,
        occurredAt: now,
        metadata: { providerRefundReference: result.providerRefundReference, providerStatus: result.status }
      }
    });
    return { id: claim.id, status: result.status === "PROCESSING" ? RefundStatus.PROCESSING_PROVIDER : RefundStatus.PROVIDER_FAILED, providerRefundReference: result.providerRefundReference, alreadyApplied: false };
  } catch (error) {
    await prisma.refund.updateMany({
      where: { id: claim.id, status: RefundStatus.PROCESSING_PROVIDER },
      data: { status: RefundStatus.PROVIDER_FAILED }
    });
    throw error;
  }
}

/** Reconciles an asynchronous refund using the provider's canonical refund resource. */
export async function refreshProviderRefundStatus(refundIdInput: string, now = new Date()) {
  const refundId = z.string().trim().min(1).max(128).parse(refundIdInput);
  const actor = await requirePermission({ permissionKey: "payments:refund", now });
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      id: true, orderId: true, status: true, externalReference: true,
      payment: { select: { id: true, provider: true, providerConfigId: true } }
    }
  });
  if (!refund) throw new Error("Refund not found.");
  if (refund.status === RefundStatus.COMPLETED) return { id: refund.id, status: refund.status, alreadyApplied: true };
  if ((refund.status !== RefundStatus.PROCESSING_PROVIDER && refund.status !== RefundStatus.PROVIDER_FAILED) || !refund.externalReference) {
    throw new Error("Only provider refunds with a returned reference can be refreshed.");
  }
  const snapshot = await getPaymentProviderRuntimeSnapshot(refund.payment.id);
  if (refund.payment.providerConfigId && !snapshot) throw new Error("The managed payment credential snapshot is unavailable.");
  const adapter = refundAdapter(refund.payment.provider);
  const status = await adapter.getRefundStatus(refund.externalReference, snapshot?.credentials, snapshot?.environment);
  if (status === "COMPLETED") return finalizeProviderRefund(refund.id, refund.externalReference, actor.userId, now);
  if (status === "FAILED" || status === "PROCESSING") {
    const changed = await prisma.refund.updateMany({
      where: { id: refund.id, status: refund.status, externalReference: refund.externalReference },
      data: status === "FAILED"
        ? { status: RefundStatus.PROVIDER_FAILED, externalReference: null, providerSubmittedAt: null, providerAttempt: { increment: 1 } }
        : { status: RefundStatus.PROCESSING_PROVIDER }
    });
    if (changed.count === 0) {
      const current = await prisma.refund.findUnique({ where: { id: refund.id }, select: { status: true } });
      return { id: refund.id, status: current?.status ?? refund.status, alreadyApplied: true };
    }
  }
  await prisma.auditLog.create({
    data: {
      actorType: AuditActorType.USER, actorId: actor.userId,
      action: status === "FAILED" ? "refund.provider_failed" : "refund.provider_checked",
      resource: "refund", resourceId: refund.id, scopeType: "ORDER", scopeId: refund.orderId,
      occurredAt: now, metadata: { providerRefundReference: refund.externalReference, providerStatus: status }
    }
  });
  return { id: refund.id, status: status === "FAILED" ? RefundStatus.PROVIDER_FAILED : RefundStatus.PROCESSING_PROVIDER, alreadyApplied: false };
}
