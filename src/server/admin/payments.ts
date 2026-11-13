import "server-only";

import { PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/server/identity/permission-guard";

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  provider: z.string().trim().min(1).max(64).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

export async function listAdminPayments(input: unknown, now = new Date()) {
  const filters = listSchema.parse(input);
  await requireAnyPermission([{ permissionKey: "payments:read", now }, { permissionKey: "payments:refund", now }], now);
  const q = filters.q || undefined;
  const where: Prisma.PaymentWhereInput = {
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(q ? {
      OR: [
        { id: q },
        { orderId: q },
        { provider: { contains: q, mode: "insensitive" } },
        {
          order: {
            is: { orderNumber: { contains: q, mode: "insensitive" } }
          }
        },
        {
          order: {
            is: {
              user: {
                is: { email: { contains: q, mode: "insensitive" } }
              }
            }
          }
        }
      ]
    } : {})
  };

  const [total, payments, aggregates] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        orderId: true,
        provider: true,
        status: true,
        amountMinor: true,
        currencyCode: true,
        currency: { select: { minorUnit: true } },
        failureCode: true,
        createdAt: true,
        succeededAt: true,
        order: {
          select: {
            orderNumber: true,
            status: true,
            user: { select: { email: true, displayName: true } }
          }
        }
      }
    }),
    prisma.payment.groupBy({
      by: ["status", "currencyCode"],
      where,
      _count: { _all: true },
      _sum: { amountMinor: true },
      orderBy: [{ status: "asc" }, { currencyCode: "asc" }]
    })
  ]);
  const currencies = await prisma.currency.findMany({
    where: { code: { in: [...new Set(aggregates.map((aggregate) => aggregate.currencyCode))] } },
    select: { code: true, minorUnit: true }
  });
  const minorUnits = new Map(currencies.map((currency) => [currency.code, currency.minorUnit]));
  return {
    items: payments.map((payment) => ({
      ...payment,
      amountMinor: payment.amountMinor.toString(),
      createdAt: payment.createdAt.toISOString(),
      succeededAt: payment.succeededAt?.toISOString() ?? null
    })),
    totalsByStatusCurrency: aggregates.map((aggregate) => ({
      status: aggregate.status,
      currencyCode: aggregate.currencyCode,
      minorUnit: minorUnits.get(aggregate.currencyCode) ?? 2,
      paymentCount: aggregate._count._all,
      amountMinor: aggregate._sum.amountMinor?.toString() ?? "0"
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit)
  };
}

export async function getAdminPayment(paymentId: string, now = new Date()) {
  const id = z.string().trim().min(1).max(128).parse(paymentId);
  await requireAnyPermission([{ permissionKey: "payments:read", now }, { permissionKey: "payments:refund", now }], now);
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: {
      id: true,
      orderId: true,
      provider: true,
      status: true,
      amountMinor: true,
      currencyCode: true,
      currency: { select: { minorUnit: true } },
      failureCode: true,
      failureMessage: true,
      expiresAt: true,
      succeededAt: true,
      lastProviderEventAt: true,
      createdAt: true,
      updatedAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          totalMinor: true,
          currencyCode: true,
          currency: { select: { minorUnit: true } },
          placedAt: true,
          user: { select: { id: true, email: true, displayName: true } }
        }
      },
      events: {
        orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          provider: true,
          eventType: true,
          payloadHash: true,
          receivedAt: true,
          processedAt: true,
          processingError: true
        }
      }
    }
  });
  if (!payment) throw new Error("Payment was not found.");
  return {
    ...payment,
    amountMinor: payment.amountMinor.toString(),
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    succeededAt: payment.succeededAt?.toISOString() ?? null,
    lastProviderEventAt: payment.lastProviderEventAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    order: {
      ...payment.order,
      totalMinor: payment.order.totalMinor.toString(),
      placedAt: payment.order.placedAt.toISOString()
    },
    events: payment.events.map((event) => ({
      ...event,
      receivedAt: event.receivedAt.toISOString(),
      processedAt: event.processedAt?.toISOString() ?? null
    }))
  };
}
