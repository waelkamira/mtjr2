import "server-only";

import { AuditActorType, CatalogEntityStatus, Prisma, SellerStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";

const ruleInputSchema = z.object({
  scope: z.enum(["GLOBAL", "SELLER", "CATEGORY", "SELLER_CATEGORY"]),
  sellerId: z.string().trim().min(1).max(128).optional(),
  categoryId: z.string().trim().min(1).max(128).optional(),
  rateBasisPoints: z.number().int().min(0).max(10_000),
  effectiveFrom: z.date(),
  effectiveUntil: z.date().nullable().optional()
}).strict().superRefine((input, context) => {
  const needsSeller = input.scope === "SELLER" || input.scope === "SELLER_CATEGORY";
  const needsCategory = input.scope === "CATEGORY" || input.scope === "SELLER_CATEGORY";
  if (needsSeller !== Boolean(input.sellerId)) {
    context.addIssue({ code: "custom", path: ["sellerId"], message: "Seller selection does not match the rule scope." });
  }
  if (needsCategory !== Boolean(input.categoryId)) {
    context.addIssue({ code: "custom", path: ["categoryId"], message: "Category selection does not match the rule scope." });
  }
  if (input.effectiveUntil && input.effectiveUntil <= input.effectiveFrom) {
    context.addIssue({ code: "custom", path: ["effectiveUntil"], message: "The end date must be after the start date." });
  }
});

const idSchema = z.string().trim().min(1).max(128);

function scopeFields(scope: z.infer<typeof ruleInputSchema>["scope"], sellerId?: string, categoryId?: string) {
  return {
    sellerId: scope === "SELLER" || scope === "SELLER_CATEGORY" ? sellerId! : null,
    categoryId: scope === "CATEGORY" || scope === "SELLER_CATEGORY" ? categoryId! : null
  };
}

function scopeType(sellerId: string | null, categoryId: string | null) {
  if (sellerId && categoryId) return "SELLER_CATEGORY";
  if (sellerId) return "SELLER";
  if (categoryId) return "CATEGORY";
  return "GLOBAL";
}

export async function listCommissionRules(now = new Date()) {
  await requirePlatformManagement(now);
  const [rules, sellers, categories] = await Promise.all([
    prisma.commissionRule.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true, sellerId: true, categoryId: true, rateBasisPoints: true,
        effectiveFrom: true, effectiveUntil: true, isActive: true, deactivatedAt: true, createdAt: true,
        seller: { select: { displayName: true, owner: { select: { email: true } } } },
        category: { select: { name: true } }
      }
    }),
    prisma.seller.findMany({
      where: { status: SellerStatus.ACTIVE },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: { id: true, displayName: true, owner: { select: { email: true } } }
    }),
    prisma.category.findMany({
      where: { status: CatalogEntityStatus.ACTIVE },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    })
  ]);
  return {
    rules: rules.map((rule) => ({
      id: rule.id,
      scope: scopeType(rule.sellerId, rule.categoryId),
      sellerId: rule.sellerId,
      sellerName: rule.seller?.displayName || rule.seller?.owner.email || null,
      categoryId: rule.categoryId,
      categoryName: rule.category?.name ?? null,
      rateBasisPoints: rule.rateBasisPoints,
      effectiveFrom: rule.effectiveFrom.toISOString(),
      effectiveUntil: rule.effectiveUntil?.toISOString() ?? null,
      isActive: rule.isActive,
      deactivatedAt: rule.deactivatedAt?.toISOString() ?? null,
      createdAt: rule.createdAt.toISOString()
    })),
    sellers: sellers.map((seller) => ({
      id: seller.id,
      name: seller.displayName || seller.owner.email
    })),
    categories
  };
}

export async function createCommissionRule(input: unknown, now = new Date()) {
  const data = ruleInputSchema.parse(input);
  const actor = await requirePlatformManagement(now);
  const scope = scopeFields(data.scope, data.sellerId, data.categoryId);
  const lockKey = JSON.stringify([scope.sellerId, scope.categoryId]);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const conflicting = await tx.commissionRule.findFirst({
      where: {
        ...scope,
        isActive: true,
        ...(data.effectiveUntil ? { effectiveFrom: { lt: data.effectiveUntil } } : {}),
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: data.effectiveFrom } }]
      },
      select: { id: true, effectiveFrom: true, effectiveUntil: true }
    });
    if (conflicting) throw new Error("An active rule already covers part of this effective period. Deactivate or reschedule it first.");

    if (scope.sellerId) {
      const seller = await tx.seller.findUnique({ where: { id: scope.sellerId }, select: { id: true } });
      if (!seller) throw new Error("Seller was not found.");
    }
    if (scope.categoryId) {
      const category = await tx.category.findUnique({ where: { id: scope.categoryId }, select: { id: true } });
      if (!category) throw new Error("Category was not found.");
    }

    const rule = await tx.commissionRule.create({
      data: {
        ...scope,
        rateBasisPoints: data.rateBasisPoints,
        effectiveFrom: data.effectiveFrom,
        effectiveUntil: data.effectiveUntil ?? null,
        createdById: actor.userId
      },
      select: { id: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "finance.commission_rule.created", resource: "commission_rule",
        resourceId: rule.id, scopeType: data.scope, scopeId: scope.sellerId ?? scope.categoryId ?? "GLOBAL",
        occurredAt: now,
        metadata: {
          sellerId: scope.sellerId, categoryId: scope.categoryId,
          rateBasisPoints: data.rateBasisPoints,
          effectiveFrom: data.effectiveFrom.toISOString(),
          effectiveUntil: data.effectiveUntil?.toISOString() ?? null
        }
      }
    });
    return { id: rule.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deactivateCommissionRule(ruleId: string, reason: string, now = new Date()) {
  const id = idSchema.parse(ruleId);
  const normalizedReason = z.string().trim().min(5).max(500).parse(reason);
  const actor = await requirePlatformManagement(now);
  return prisma.$transaction(async (tx) => {
    const rule = await tx.commissionRule.findUnique({
      where: { id },
      select: { id: true, sellerId: true, categoryId: true, isActive: true }
    });
    if (!rule) throw new Error("Commission rule was not found.");
    if (!rule.isActive) throw new Error("Commission rule is already inactive.");
    const changed = await tx.commissionRule.updateMany({
      where: { id, isActive: true },
      data: { isActive: false, deactivatedAt: now }
    });
    if (changed.count !== 1) throw new Error("Commission rule changed concurrently. Reload and retry.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId,
        action: "finance.commission_rule.deactivated", resource: "commission_rule",
        resourceId: id, scopeType: scopeType(rule.sellerId, rule.categoryId),
        scopeId: rule.sellerId ?? rule.categoryId ?? "GLOBAL", occurredAt: now,
        metadata: { reason: normalizedReason }
      }
    });
    return { id, isActive: false };
  });
}

const transactionListSchema = z.object({
  sellerId: z.string().trim().min(1).max(128).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

export async function listCommissionTransactions(input: unknown, now = new Date()) {
  const filters = transactionListSchema.parse(input);
  await requirePlatformManagement(now);
  const where: Prisma.CommissionTransactionWhereInput = {
    ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
    ...(filters.currencyCode ? { currencyCode: filters.currencyCode } : {})
  };
  const [total, items, totals] = await Promise.all([
    prisma.commissionTransaction.count({ where }),
    prisma.commissionTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true, orderId: true, vendorOrderId: true, storeId: true, sellerId: true,
        categoryName: true, ruleScopeType: true, rateBasisPoints: true, baseAmountMinor: true,
        commissionMinor: true, currencyCode: true, createdAt: true,
        order: { select: { orderNumber: true } },
        store: { select: { name: true } },
        seller: { select: { displayName: true, owner: { select: { email: true } } } },
        currency: { select: { minorUnit: true } }
      }
    }),
    prisma.commissionTransaction.groupBy({
      by: ["currencyCode"],
      where,
      _sum: { baseAmountMinor: true, commissionMinor: true },
      _count: { _all: true },
      orderBy: { currencyCode: "asc" }
    })
  ]);
  return {
    items: items.map(({ currency, seller, ...item }) => ({
      ...item,
      baseAmountMinor: item.baseAmountMinor.toString(),
      commissionMinor: item.commissionMinor.toString(),
      currencyMinorUnit: currency.minorUnit,
      createdAt: item.createdAt.toISOString(),
      sellerName: seller.displayName || seller.owner.email
    })),
    totalsByCurrency: totals.map((total) => ({
      currencyCode: total.currencyCode,
      itemCount: total._count._all,
      baseAmountMinor: total._sum.baseAmountMinor?.toString() ?? "0",
      commissionMinor: total._sum.commissionMinor?.toString() ?? "0"
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pageCount: Math.ceil(total / filters.limit)
  };
}
