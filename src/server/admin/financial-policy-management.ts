import "server-only";

import { AuditActorType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformManagement } from "@/server/identity/permission-guard";

const classificationSchema = z.enum(["LEGAL", "CONTRACTUAL", "PLATFORM"]);
const approvalActionSchema = z.enum(["REVIEW", "APPROVE", "REJECT"]);

const createSchema = z.object({
  key: z.string().trim().min(3).max(120).regex(/^[A-Z0-9][A-Z0-9_.:-]*$/),
  domain: z.string().trim().min(2).max(64).regex(/^[A-Z0-9_]+$/),
  description: z.string().trim().max(500).nullable().optional(),
  classification: classificationSchema,
  countryCode: z.string().trim().length(2).toUpperCase().nullable().optional(),
  subdivisionCode: z.string().trim().min(1).max(32).toUpperCase().nullable().optional(),
  marketCode: z.string().trim().min(1).max(32).toUpperCase().nullable().optional(),
  currencyCode: z.string().trim().length(3).toUpperCase().nullable().optional(),
  productClass: z.string().trim().min(1).max(80).toUpperCase().nullable().optional(),
  paymentProvider: z.string().trim().min(1).max(80).toUpperCase().nullable().optional(),
  sellerId: z.string().trim().min(1).max(128).nullable().optional(),
  categoryId: z.string().trim().min(1).max(128).nullable().optional(),
  priority: z.number().int().min(-100000).max(100000).default(0),
  value: z.record(z.string(), z.unknown()),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  sourceReference: z.string().trim().url().max(2048).nullable().optional(),
  reviewNotes: z.string().trim().max(2000).nullable().optional()
}).strict().superRefine((data, ctx) => {
  if (data.effectiveUntil && new Date(data.effectiveUntil) <= new Date(data.effectiveFrom)) {
    ctx.addIssue({ code: "custom", path: ["effectiveUntil"], message: "Effective end must be after effective start." });
  }
  if (data.subdivisionCode && !data.countryCode) {
    ctx.addIssue({ code: "custom", path: ["countryCode"], message: "A subdivision scope requires a country." });
  }
  if (data.classification === "LEGAL" && !data.countryCode) {
    ctx.addIssue({ code: "custom", path: ["countryCode"], message: "Legal policies must be scoped to a country." });
  }
});

const actionSchema = z.object({
  action: approvalActionSchema,
  notes: z.string().trim().min(5).max(2000).optional(),
}).strict().superRefine((data, ctx) => {
  if (data.action === "REJECT" && !data.notes) ctx.addIssue({ code: "custom", path: ["notes"], message: "A rejection reason is required." });
});

const idSchema = z.string().trim().min(1).max(128);

function auditData(actorId: string, action: string, resourceId: string, metadata: Prisma.InputJsonObject, now: Date) {
  return {
    actorType: AuditActorType.USER,
    actorId,
    action,
    resource: "financial_policy_rule_version",
    resourceId,
    scopeType: "GLOBAL",
    scopeId: "GLOBAL",
    metadata,
    occurredAt: now
  };
}

export async function listFinancialPolicyVersions(input: unknown = {}, now = new Date()) {
  await requirePlatformManagement(now);
  const query = z.object({
    key: z.string().trim().max(120).optional(),
    domain: z.string().trim().max(64).optional(),
    approvalStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().trim().min(1).max(128).optional()
  }).strict().parse(input);

  const rows = await prisma.financialPolicyRuleVersion.findMany({
    where: {
      ...((query.domain || query.key) ? { rule: { AND: [
        ...(query.domain ? [{ domain: query.domain }] : []),
        ...(query.key ? [{ key: query.key }] : [])
      ] } } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: { rule: { select: { key: true, domain: true, description: true } } }
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    versions: page.map((row) => ({ ...row, value: row.value })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    limit: query.limit
  };
}

export async function createFinancialPolicyVersion(input: unknown, now = new Date()) {
  const data = createSchema.parse(input);
  const actor = await requirePlatformManagement(now);
  if (data.classification === "LEGAL" && (!data.sourceReference || !data.reviewNotes)) {
    throw new Error("Legal policy drafts require a source reference and review notes.");
  }

  return prisma.$transaction(async (tx) => {
    const lockKey = `financial-policy:${data.key}`;
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    if (data.countryCode) {
      const country = await tx.country.findUnique({ where: { iso2: data.countryCode }, select: { iso2: true } });
      if (!country) throw new Error("Country code is not configured.");
    }
    if (data.marketCode) {
      const market = await tx.market.findUnique({ where: { code: data.marketCode }, select: { id: true, code: true, country: { select: { iso2: true } } } });
      if (!market) throw new Error("Market code is not configured.");
      if (data.countryCode && market.country.iso2 !== data.countryCode) throw new Error("Market does not belong to the selected country.");
      if (data.currencyCode) {
        const marketCurrency = await tx.marketCurrency.findUnique({
          where: { marketId_currencyCode: { marketId: market.id, currencyCode: data.currencyCode } },
          select: { isEnabled: true }
        });
        if (!marketCurrency?.isEnabled) throw new Error("Currency is not enabled for the selected market.");
      }
    }
    if (data.currencyCode) {
      const currency = await tx.currency.findUnique({ where: { code: data.currencyCode }, select: { code: true } });
      if (!currency) throw new Error("Currency code is not configured.");
    }
    if (data.sellerId && !await tx.seller.findUnique({ where: { id: data.sellerId }, select: { id: true } })) {
      throw new Error("Seller was not found.");
    }
    if (data.categoryId && !await tx.category.findUnique({ where: { id: data.categoryId }, select: { id: true } })) {
      throw new Error("Category was not found.");
    }

    const rule = await tx.financialPolicyRule.upsert({
      where: { key: data.key },
      create: { key: data.key, domain: data.domain, description: data.description ?? null },
      update: {}
    });
    if (rule.domain !== data.domain) throw new Error("A policy key cannot be reused in another domain.");

    const previous = await tx.financialPolicyRuleVersion.findFirst({
      where: { ruleId: rule.id }, orderBy: { version: "desc" }, select: { version: true }
    });
    const version = await tx.financialPolicyRuleVersion.create({
      data: {
        ruleId: rule.id,
        version: (previous?.version ?? 0) + 1,
        classification: data.classification,
        approvalStatus: "PENDING_REVIEW",
        countryCode: data.countryCode ?? null,
        subdivisionCode: data.subdivisionCode ?? null,
        marketCode: data.marketCode ?? null,
        currencyCode: data.currencyCode ?? null,
        productClass: data.productClass ?? null,
        paymentProvider: data.paymentProvider ?? null,
        sellerId: data.sellerId ?? null,
        categoryId: data.categoryId ?? null,
        priority: data.priority,
        value: data.value as Prisma.InputJsonValue,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : null,
        sourceReference: data.sourceReference ?? null,
        reviewNotes: data.reviewNotes ?? null,
        createdById: actor.userId
      },
      select: { id: true, version: true, ruleId: true }
    });
    await tx.auditLog.create({
      data: auditData(actor.userId, "finance.policy_version.created", version.id, {
        key: data.key, domain: data.domain, version: version.version,
        classification: data.classification, approvalStatus: "PENDING_REVIEW"
      }, now)
    });
    return version;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function transitionFinancialPolicyVersion(versionId: string, input: unknown, now = new Date()) {
  const id = idSchema.parse(versionId);
  const action = actionSchema.parse(input);
  const actor = await requirePlatformManagement(now);

  return prisma.$transaction(async (tx) => {
    const version = await tx.financialPolicyRuleVersion.findUnique({
      where: { id }, include: { rule: { select: { key: true, domain: true } } }
    });
    if (!version) throw new Error("Financial policy version was not found.");
    if (version.approvalStatus !== "PENDING_REVIEW") throw new Error("Only pending policy versions can be reviewed.");

    let update: Prisma.FinancialPolicyRuleVersionUpdateInput;
    if (action.action === "REVIEW") {
      if (version.createdById === actor.userId) throw new Error("The policy author cannot review their own policy.");
      if (version.reviewedAt) throw new Error("This policy version has already been reviewed.");
      if (version.classification === "LEGAL" && !version.sourceReference) {
        throw new Error("A legal source reference is required before review.");
      }
      update = {
        reviewedAt: now,
        reviewedById: actor.userId,
        ...(action.notes ? { reviewNotes: action.notes } : {})
      };
    } else if (action.action === "APPROVE") {
      if (version.createdById === actor.userId) throw new Error("The policy author cannot approve their own policy.");
      if (version.classification === "LEGAL" && (!version.reviewedAt || !version.reviewedById || version.reviewedById === actor.userId)) {
        throw new Error("Legal policy approval requires a separate completed review.");
      }
      update = {
        approvalStatus: "APPROVED",
        approvedAt: now,
        approvedById: actor.userId,
        ...(action.notes ? { reviewNotes: action.notes } : {})
      };
    } else {
      if (version.createdById === actor.userId) throw new Error("The policy author cannot reject their own policy.");
      update = {
        approvalStatus: "REJECTED",
        rejectionReason: action.notes ?? "Rejected by platform management.",
        rejectedAt: now,
        rejectedById: actor.userId
      };
    }

    const updated = await tx.financialPolicyRuleVersion.update({
      where: { id },
      data: update,
      select: { id: true, approvalStatus: true, reviewedAt: true, reviewedById: true, approvedAt: true, approvedById: true }
    });
    await tx.auditLog.create({
      data: auditData(actor.userId, `finance.policy_version.${action.action.toLowerCase()}`, id, {
        key: version.rule.key, domain: version.rule.domain, action: action.action,
        previousStatus: version.approvalStatus, nextStatus: updated.approvalStatus,
        notes: action.notes ?? null, sourceReferenceProvided: Boolean(action.sourceReference)
      }, now)
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
