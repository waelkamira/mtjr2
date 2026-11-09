import "server-only";

import { createHash } from "node:crypto";
import { PaymentStatus, OrderStatus, VendorOrderStatus, Prisma, PaymentProviderEnvironment } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { getPaymentProvider, getPaymentProviderAdapter } from "./providers/registry";
import { getActivePaymentProviderRuntimeConfig, getPaymentProviderRuntimeSnapshot } from "@/server/admin/payment-providers";
import type { VerifiedPaymentEvent } from "./providers/types";
import { createInAppNotification } from "@/server/notifications/notifications";
import {
  allocateDiscountAcrossLines,
  calculateCommissionMinor,
  selectCommissionRule
} from "@/server/admin/commission-policy";

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
    select: { id: true, orderNumber: true, status: true, totalMinor: true, currencyCode: true, address: { select: { countryCode: true } } }
  });
  if (!order) throw new Error("Order not found.");
  if (order.status !== OrderStatus.PENDING_PAYMENT) throw new Error("This order is not awaiting payment.");
  if (order.totalMinor <= BigInt(0)) throw new Error("A zero-value order does not require a payment.");

  const providerEnvironment = process.env.NODE_ENV === "production"
    ? PaymentProviderEnvironment.LIVE
    : PaymentProviderEnvironment.TEST;
  const idempotentAttempt = await prisma.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });
  if (idempotentAttempt && (idempotentAttempt.orderId !== order.id || idempotentAttempt.provider !== input.providerKey)) {
    throw new Error("The payment idempotency key is already used for another request.");
  }
  if (idempotentAttempt && (idempotentAttempt.status !== PaymentStatus.INITIATING || idempotentAttempt.checkoutUrl)) {
    return serializePayment(idempotentAttempt);
  }
  const activeAttempt = idempotentAttempt ? null : await prisma.payment.findFirst({
    where: {
      orderId: order.id,
      status: { in: [PaymentStatus.INITIATING, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, provider: true, providerConfigId: true }
  });
  const reusableAttempt = idempotentAttempt ?? activeAttempt;
  const reusableSnapshot = reusableAttempt?.provider === input.providerKey
    ? await getPaymentProviderRuntimeSnapshot(reusableAttempt.id)
    : null;
  const reusableIsLegacy = Boolean(reusableAttempt && !reusableAttempt.providerConfigId);
  const runtimeSelection = input.providerKey === "stripe" || input.providerKey === "paypal"
    ? await getActivePaymentProviderRuntimeConfig(
        input.providerKey,
        providerEnvironment,
        order.currencyCode,
        order.address?.countryCode ?? null
      )
    : { managed: false as const, config: null };
  if (runtimeSelection.managed && !runtimeSelection.config && !reusableSnapshot && !reusableIsLegacy) {
    throw new Error("This payment provider is disabled or does not support this order's country or currency.");
  }
  const legacyProvider = runtimeSelection.managed && !reusableIsLegacy ? null : getPaymentProvider(input.providerKey);
  if (!runtimeSelection.config && !legacyProvider && !reusableSnapshot) {
    throw new Error("This payment provider is not configured for the platform.");
  }
  const provider = legacyProvider;

  const payment = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${order.id}, 0))`);
    const currentOrder = await tx.order.findFirst({
      where: { id: order.id, ...ownerWhere(owner), status: OrderStatus.PENDING_PAYMENT },
      select: { id: true }
    });
    if (!currentOrder) throw new Error("This order is no longer awaiting payment.");
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.orderId !== order.id || existing.provider !== input.providerKey) {
        throw new Error("The payment idempotency key is already used for another request.");
      }
      return existing;
    }
    const active = await tx.payment.findFirst({
      where: { orderId: order.id, status: { in: [PaymentStatus.INITIATING, PaymentStatus.REQUIRES_ACTION, PaymentStatus.PROCESSING] } },
      orderBy: { createdAt: "desc" }
    });
    if (active) {
      if (active.provider !== input.providerKey) throw new Error("A payment attempt is already active with another provider. Complete or cancel it before switching methods.");
      return active;
    }
    // Re-check the selected database configuration inside the payment transaction.
    // This closes the window where an administrator disables or changes a provider
    // after the initial lookup but before a new payment attempt is persisted.
    if (runtimeSelection.config) {
      const currentConfig = await tx.paymentProviderConfig.findUnique({
        where: { providerKey_environment: { providerKey: input.providerKey, environment: providerEnvironment } }
      });
      const method = input.providerKey === "stripe" ? "card" : "paypal";
      if (
        !currentConfig ||
        currentConfig.id !== runtimeSelection.config.id ||
        currentConfig.status !== "ACTIVE" ||
        currentConfig.encryptedCredentials !== runtimeSelection.config.encryptedCredentials ||
        currentConfig.credentialsKeyVersion !== runtimeSelection.config.credentialsKeyVersion ||
        (currentConfig.supportedCurrencies.length > 0 && !currentConfig.supportedCurrencies.includes(order.currencyCode)) ||
        (currentConfig.supportedCountries.length > 0 && (!order.address?.countryCode || !currentConfig.supportedCountries.includes(order.address.countryCode))) ||
        (currentConfig.enabledPaymentMethods.length > 0 && !currentConfig.enabledPaymentMethods.includes(method))
      ) {
        throw new Error("This payment provider was changed or disabled before the payment attempt could be created. Refresh and choose an available method.");
      }
    }
    return tx.payment.create({
      data: {
        orderId: order.id, provider: input.providerKey, amountMinor: order.totalMinor,
        currencyCode: order.currencyCode, idempotencyKey: input.idempotencyKey,
        ...(runtimeSelection.config ? {
          providerConfigId: runtimeSelection.config.id,
          providerEnvironment: runtimeSelection.config.environment,
          encryptedProviderCredentials: runtimeSelection.config.encryptedCredentials,
          providerCredentialsKeyVersion: runtimeSelection.config.credentialsKeyVersion
        } : {}),
        status: PaymentStatus.INITIATING
      }
    });
  });

  if (payment.status !== PaymentStatus.INITIATING || payment.checkoutUrl) return serializePayment(payment);

  try {
    const returnUrl = new URL(`/orders/${encodeURIComponent(order.id)}`, env.APP_URL).toString();
    const snapshot = await getPaymentProviderRuntimeSnapshot(payment.id);
    const providerCredentials = snapshot?.credentials ?? (reusableIsLegacy ? undefined : runtimeSelection.config?.credentials);
    const providerAdapter = reusableIsLegacy
      ? getPaymentProvider(payment.provider)
      : provider ?? getPaymentProviderAdapter(payment.provider);
    if (!providerAdapter) throw new Error("The payment provider adapter is unavailable.");
    const intent = await providerAdapter.createIntent({
      paymentId: payment.id, orderNumber: order.orderNumber, amountMinor: order.totalMinor.toString(),
      currencyCode: order.currencyCode, idempotencyKey: payment.idempotencyKey, returnUrl,
      metadata: { orderId: order.id, paymentId: payment.id },
      ...(providerCredentials ? { providerCredentials } : {}),
      ...((snapshot?.environment ?? runtimeSelection.config?.environment)
        ? { providerEnvironment: snapshot?.environment ?? runtimeSelection.config!.environment }
        : {})
    });
    const checkoutUrl = new URL(intent.checkoutUrl);
    if (checkoutUrl.protocol !== "https:") throw new Error("Payment provider returned an insecure checkout URL.");
    if (!intent.providerReference.trim()) throw new Error("Payment provider returned an empty reference.");
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATING },
      data: {
        providerReference: intent.providerReference, checkoutUrl: checkoutUrl.toString(),
        expiresAt: intent.expiresAt ?? null, status: PaymentStatus.REQUIRES_ACTION,
        failureCode: null, failureMessage: null
      }
    });
    // Another retry may have initialized the payment and a webhook may have
    // advanced it while this provider request was in flight.
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
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
        include: {
          order: {
            include: {
              vendorOrders: {
                include: {
                  items: {
                    select: {
                      id: true,
                      lineTotalMinor: true,
                      commissionCategoryId: true,
                      commissionCategoryName: true
                    }
                  },
                  store: {
                    include: {
                      seller: { select: { id: true, ownerId: true } }
                    }
                  }
                }
              }
            }
          }
        }
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
        if (input.event.eventType === "succeeded") {
          // A late/replayed success event must never erase a recorded refund or dispute state.
          if (payment.status !== PaymentStatus.REFUNDED && payment.status !== PaymentStatus.PARTIALLY_REFUNDED && payment.status !== PaymentStatus.DISPUTED) {
            nextStatus = PaymentStatus.SUCCEEDED;
          }
        } else if (
          payment.status !== PaymentStatus.SUCCEEDED &&
          payment.status !== PaymentStatus.FAILED &&
          payment.status !== PaymentStatus.CANCELLED &&
          payment.status !== PaymentStatus.REFUNDED &&
          payment.status !== PaymentStatus.PARTIALLY_REFUNDED &&
          payment.status !== PaymentStatus.DISPUTED
        ) {
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
        const sellerIds = [...new Set(payment.order.vendorOrders.map((vendor) => vendor.store.seller.id))];
        const categoryIds = [...new Set(payment.order.vendorOrders.flatMap((vendor) =>
          vendor.items.flatMap((item) => item.commissionCategoryId ? [item.commissionCategoryId] : [])
        ))];
        const commissionRules = await tx.commissionRule.findMany({
          where: {
            effectiveFrom: { lte: input.event.occurredAt },
            AND: [
              { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: input.event.occurredAt } }] },
              { OR: [{ deactivatedAt: null }, { deactivatedAt: { gt: input.event.occurredAt } }] },
              {
                OR: [
                  { sellerId: null, categoryId: null },
                  ...(sellerIds.length ? [{ sellerId: { in: sellerIds }, categoryId: null }] : []),
                  ...(categoryIds.length ? [{ sellerId: null, categoryId: { in: categoryIds } }] : []),
                  ...(sellerIds.length && categoryIds.length
                    ? [{ sellerId: { in: sellerIds }, categoryId: { in: categoryIds } }]
                    : [])
                ]
              }
            ]
          },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          select: {
            id: true, sellerId: true, categoryId: true, rateBasisPoints: true,
            effectiveFrom: true, effectiveUntil: true, isActive: true, deactivatedAt: true
          }
        });

        for (const vendor of payment.order.vendorOrders) {
          const itemSubtotals = vendor.items.reduce((total, item) => total + item.lineTotalMinor, BigInt(0));
          if (itemSubtotals !== vendor.subtotalMinor) {
            throw new Error("Vendor order item totals do not match the saved merchandise subtotal.");
          }
          const bases = allocateDiscountAcrossLines(
            vendor.items.map((item) => ({ id: item.id, lineTotalMinor: item.lineTotalMinor })),
            vendor.discountMinor
          );
          await tx.commissionTransaction.createMany({
            data: vendor.items.map((item) => {
              const { rule, scope } = selectCommissionRule(
                commissionRules,
                vendor.store.seller.id,
                item.commissionCategoryId,
                input.event.occurredAt
              );
              const baseAmountMinor = bases.get(item.id);
              if (baseAmountMinor === undefined) throw new Error("Commission base allocation is incomplete.");
              const rateBasisPoints = rule?.rateBasisPoints ?? 0;
              return {
                orderId: payment.orderId,
                vendorOrderId: vendor.id,
                orderItemId: item.id,
                storeId: vendor.storeId,
                sellerId: vendor.store.seller.id,
                commissionRuleId: rule?.id ?? null,
                categoryId: item.commissionCategoryId,
                categoryName: item.commissionCategoryName,
                ruleScopeType: scope,
                rateBasisPoints,
                baseAmountMinor,
                commissionMinor: calculateCommissionMinor(baseAmountMinor, rateBasisPoints),
                currencyCode: payment.currencyCode,
                createdAt: now
              };
            })
          });
        }

        await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.CONFIRMED } });
        await tx.orderStatusHistory.create({
          data: { orderId: payment.orderId, status: OrderStatus.CONFIRMED, note: "Payment confirmed by a verified provider event.", createdAt: now }
        });
        for (const vendor of payment.order.vendorOrders) {
          await tx.vendorOrder.update({ where: { id: vendor.id }, data: { status: VendorOrderStatus.CONFIRMED } });
          await tx.vendorOrderStatusHistory.create({
            data: { vendorOrderId: vendor.id, status: VendorOrderStatus.CONFIRMED, note: "Payment confirmed by a verified provider event.", createdAt: now }
          });
          await createInAppNotification(tx, {
            data: {
              userId: vendor.store.seller.ownerId, type: "PAYMENT_CONFIRMED",
              title: "Payment confirmed for a new order",
              message: `Payment for order ${payment.order.orderNumber} is confirmed. Your store can begin order processing.`,
              resourceType: "VENDOR_ORDER", resourceId: vendor.id,
              deduplicationKey: `payment:${payment.id}:vendor-order:${vendor.id}:confirmed`
            }
          });
        }
        if (payment.order.userId) {
          await createInAppNotification(tx, {
            data: {
              userId: payment.order.userId, type: "PAYMENT_CONFIRMED",
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


      if (isNewerEvent && nextStatus === PaymentStatus.FAILED && payment.order.userId) {
        await createInAppNotification(tx, {
          data: {
            userId: payment.order.userId, type: "PAYMENT_FAILED",
            title: "Payment was not completed",
            message: `Payment for order ${payment.order.orderNumber} failed. You can review the order and try another payment method.`,
            resourceType: "ORDER", resourceId: payment.orderId,
            deduplicationKey: `payment:${payment.id}:order:${payment.orderId}:failed`
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

export async function listAvailablePaymentProviders(input?: { currencyCode?: string; countryCode?: string }) {
  const environment = process.env.NODE_ENV === "production"
    ? PaymentProviderEnvironment.LIVE
    : PaymentProviderEnvironment.TEST;
  const managed = await prisma.paymentProviderConfig.findMany({
    where: { environment },
    select: {
      providerKey: true, displayName: true, status: true,
      supportedCurrencies: true, supportedCountries: true, enabledPaymentMethods: true
    },
    orderBy: [{ sortOrder: "asc" }, { providerKey: "asc" }]
  });
  const managedKeys = new Set(managed.map((item) => item.providerKey));
  const activeManaged = managed.filter((item) =>
    (item.providerKey === "stripe" || item.providerKey === "paypal") &&
    item.status === "ACTIVE" &&
    (item.supportedCurrencies.length === 0 || Boolean(input?.currencyCode && item.supportedCurrencies.includes(input.currencyCode))) &&
    (item.supportedCountries.length === 0 || Boolean(input?.countryCode && item.supportedCountries.includes(input.countryCode))) &&
    (item.enabledPaymentMethods.length === 0 || item.enabledPaymentMethods.includes(item.providerKey === "stripe" ? "card" : "paypal"))
  ).map(({ providerKey, displayName }) => ({ key: providerKey, displayName }));

  const { listPaymentProviders } = await import("./providers/registry");
  const legacy = listPaymentProviders().filter((item) => !managedKeys.has(item.key));
  return [...activeManaged, ...legacy];
}
