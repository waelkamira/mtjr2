import "server-only";

import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { AdCampaignEventType, AdCampaignStatus, AdInvoiceStatus, AuditActorType, Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { requireCurrentSession } from "@/server/identity/current-session";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const TOKEN_TTL_MS = 30 * 60 * 1000;
type TokenPayload = { campaignId: string; expiresAt: number; nonce: string };
function signature(value: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
}
function makeToken(payload: TokenPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + signature(body);
}
function readToken(token: string, now: Date): TokenPayload | null {
  const [body, supplied, extra] = token.split(".");
  if (!body || !supplied || extra) return null;
  const expected = signature(body);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.campaignId || !payload.nonce || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now.getTime()) return null;
    return payload;
  } catch { return null; }
}

export async function listSponsoredCampaigns(input: {
  marketId?: string; categoryId?: string; categoryIds?: string[]; brandId?: string; query?: string; limit?: number; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.marketId) return [];
  const tokens: string[] = (input.query ?? "").normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const categoryIds = [...new Set([input.categoryId, ...(input.categoryIds ?? [])].filter((value): value is string => Boolean(value)))].slice(0, 20);
  const rows = await prisma.adCampaign.findMany({
    where: {
      status: AdCampaignStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gt: now },
      marketId: input.marketId,
      market: { status: "ACTIVE", country: { isActive: true }, currencies: { some: { isEnabled: true } } },
      AND: [
        { OR: [{ targetCategoryId: null }, ...(categoryIds.length ? [{ targetCategoryId: { in: categoryIds } }] : [])] },
        { OR: [{ targetBrandId: null }, ...(input.brandId ? [{ targetBrandId: input.brandId }] : [])] }
      ],
      product: {
        status: "ACTIVE", approvalStatus: "APPROVED",
        store: { status: "ACTIVE", seller: { status: "ACTIVE" }, markets: { some: { marketId: input.marketId, isEnabled: true } } },
        variants: { some: { isActive: true, prices: { some: { marketId: input.marketId, currency: { isActive: true } } } } }
      }
    },
    orderBy: [{ cpcBidMinor: "desc" }, { createdAt: "asc" }],
    take: Math.min(24, Math.max(1, input.limit ?? 4)),
    select: {
      id: true, currencyCode: true, budgetMinor: true, dailyBudgetMinor: true, cpcBidMinor: true, spentMinor: true,
      targetKeywords: true, product: {
        select: {
          id: true, slug: true, name: true, description: true,
          brand: { select: { name: true } },
          store: { select: { id: true, name: true, slug: true } },
          media: { take: 4, orderBy: { createdAt: "asc" }, select: { url: true, altText: true, isPrimary: true } },
          variants: {
            where: { isActive: true },
            take: 4,
            select: { prices: { where: { marketId: input.marketId }, take: 1, select: { amountMinor: true, currencyCode: true, currency: { select: { minorUnit: true } } } } }
          }
        }
      },
      spendEntries: { where: { createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) } }, select: { amountMinor: true } }
    }
  });
  return rows.filter((row) => {
    if (row.spentMinor >= row.budgetMinor) return false;
    const dailySpent = row.spendEntries.reduce((sum, entry) => sum + entry.amountMinor, BigInt(0));
    if (dailySpent >= row.dailyBudgetMinor) return false;
    if (row.targetKeywords.length && (!tokens.length || !row.targetKeywords.some(matchesKeyword))) return false;
    return Boolean(row.currencyCode) && row.product.variants.some((variant) => variant.prices.some((price) => price.currencyCode === row.currencyCode));
  }).slice(0, input.limit ?? 4).map((row) => ({
    campaignId: row.id,
    token: makeToken({ campaignId: row.id, expiresAt: now.getTime() + TOKEN_TTL_MS, nonce: createHash("sha256").update(row.id + ":" + now.getTime()).digest("hex").slice(0, 24) }),
    product: {
      ...row.product,
      variants: row.product.variants.map((variant) => ({ prices: variant.prices.filter((price) => price.currencyCode === row.currencyCode).map((price) => ({ ...price, amountMinor: price.amountMinor.toString() })) }))
    }
  }));
}

export async function recordSponsoredAdEvent(input: {
  token: string; eventId: string; type: "IMPRESSION" | "CLICK"; headers: Headers; now?: Date;
}) {
  const now = input.now ?? new Date();
  const payload = readToken(input.token, now);
  if (!payload || !/^[A-Za-z0-9_-]{16,80}$/.test(input.eventId)) throw new Error("Invalid or expired advertising event token.");
  const visitorIp = resolveTrustedClientIp(input.headers, env.TRUSTED_PROXY_IP_HEADER, env.NODE_ENV);
  const visitorHash = visitorIp ? createHash("sha256").update(visitorIp).digest("hex") : null;
  if (input.type === "CLICK" && !visitorHash) throw new Error("Trusted client IP is required before an advertising click can be billed.");
  // The campaign-scoped advisory lock serializes all budget/event mutations. Use READ COMMITTED so a waiter reads the latest committed budget after acquiring the lock; SERIALIZABLE can retain a pre-lock snapshot and spuriously abort a valid impression/click under normal concurrent page activity.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${payload.campaignId}, 0))) AS lock_result`);
    const campaign = await tx.adCampaign.findUnique({
      where: { id: payload.campaignId },
      select: { id: true, storeId: true, currencyCode: true, status: true, startsAt: true, endsAt: true, budgetMinor: true, dailyBudgetMinor: true, cpcBidMinor: true, spentMinor: true }
    });
    if (!campaign || campaign.status !== AdCampaignStatus.ACTIVE || campaign.startsAt > now || campaign.endsAt <= now || !campaign.currencyCode) {
      throw new Error("This advertising campaign is no longer deliverable.");
    }
    const existing = await tx.adCampaignEvent.findUnique({ where: { campaignId_eventId: { campaignId: campaign.id, eventId: input.eventId } } });
    if (existing) return { accepted: true, duplicate: true, chargedMinor: existing.costMinor.toString() };
    if (visitorHash) {
      const dedupeStart = new Date(now.getTime() - (input.type === "CLICK" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
      const recent = await tx.adCampaignEvent.findFirst({
        where: { campaignId: campaign.id, type: input.type === "CLICK" ? AdCampaignEventType.CLICK : AdCampaignEventType.IMPRESSION, visitorHash, occurredAt: { gte: dedupeStart } },
        select: { id: true }
      });
      if (recent) return { accepted: true, duplicate: true, chargedMinor: "0" };
    }
    const dailyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const daily = await tx.adSpendLedgerEntry.aggregate({
      where: { campaignId: campaign.id, createdAt: { gte: dailyStart } }, _sum: { amountMinor: true }
    });
    const dailySpent = daily._sum.amountMinor ?? BigInt(0);
    if (campaign.spentMinor >= campaign.budgetMinor) throw new Error("Campaign budget has been exhausted.");
    let costMinor = BigInt(0);
    if (input.type === "CLICK") {
      costMinor = campaign.cpcBidMinor;
      if (costMinor <= BigInt(0) || campaign.spentMinor + costMinor > campaign.budgetMinor || dailySpent + costMinor > campaign.dailyBudgetMinor) {
        throw new Error("Campaign budget limit has been reached.");
      }
    }
    const event = await tx.adCampaignEvent.create({
      data: { campaignId: campaign.id, eventId: input.eventId, type: input.type === "CLICK" ? AdCampaignEventType.CLICK : AdCampaignEventType.IMPRESSION, visitorHash, costMinor, occurredAt: now }
    });
    await tx.adCampaign.update({
      where: { id: campaign.id },
      data: input.type === "CLICK"
        ? { spentMinor: { increment: costMinor }, clickCount: { increment: BigInt(1) } }
        : { impressionCount: { increment: BigInt(1) } }
    });
    if (input.type === "CLICK") {
      await tx.adSpendLedgerEntry.create({
        data: { campaignId: campaign.id, eventId: event.id, storeId: campaign.storeId, currencyCode: campaign.currencyCode, amountMinor: costMinor, createdAt: now }
      });
    }
    return { accepted: true, duplicate: false, chargedMinor: costMinor.toString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function generateAdInvoices(input: { periodStart: Date; periodEnd: Date; dueAt: Date }) {
  if (input.periodStart >= input.periodEnd || input.dueAt < input.periodEnd) throw new Error("Invalid advertising invoice period.");
  const totals = await prisma.adSpendLedgerEntry.groupBy({
    by: ["storeId", "currencyCode"],
    where: { createdAt: { gte: input.periodStart, lt: input.periodEnd } },
    _sum: { amountMinor: true }
  });
  if (!totals.length) return { created: 0, stores: 0 };
  const result = await prisma.adInvoice.createMany({
    data: totals.filter((row) => (row._sum.amountMinor ?? BigInt(0)) > BigInt(0)).map((row) => ({
      storeId: row.storeId, currencyCode: row.currencyCode, periodStart: input.periodStart,
      periodEnd: input.periodEnd, dueAt: input.dueAt, amountMinor: row._sum.amountMinor!
    })),
    skipDuplicates: true
  });
  return { created: result.count, stores: totals.length };
}

export async function listSellerAdInvoices(storeId: string, now = new Date()) {
  const actor = await requireCurrentSession(now);
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, seller: { select: { ownerId: true } } } });
  if (!store || (store.seller.ownerId !== actor.userId && !(await userHasScopedPermission(actor.userId, { permissionKey: "ads:manage", scope: { type: "STORE", id: storeId }, now })))) {
    throw new Error("You do not have access to this store's advertising invoices.");
  }
  const rows = await prisma.adInvoice.findMany({ where: { storeId }, orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }], take: 100, select: { id: true, currencyCode: true, periodStart: true, periodEnd: true, amountMinor: true, status: true, dueAt: true, createdAt: true, currency: { select: { minorUnit: true } } } });
  return rows.map((row) => ({ ...row, amountMinor: row.amountMinor.toString() }));
}

export async function getAdminAdvertisingAnalytics(now = new Date()) {
  await (await import("@/server/identity/permission-guard")).requirePermission({ permissionKey: "ads:moderate", now });
  const [campaigns, spendByCurrency, invoicesByCurrency, activeCampaigns] = await Promise.all([
    prisma.adCampaign.aggregate({ _count: { _all: true }, _sum: { impressionCount: true, clickCount: true } }),
    prisma.adSpendLedgerEntry.groupBy({ by: ["currencyCode"], _sum: { amountMinor: true } }),
    prisma.adInvoice.groupBy({ by: ["currencyCode", "status"], _sum: { amountMinor: true }, _count: { _all: true } }),
    prisma.adCampaign.count({ where: { status: AdCampaignStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gt: now } } })
  ]);
  return {
    campaignCount: campaigns._count._all,
    activeCampaigns,
    impressions: (campaigns._sum.impressionCount ?? BigInt(0)).toString(),
    clicks: (campaigns._sum.clickCount ?? BigInt(0)).toString(),
    spendByCurrency: spendByCurrency.map((row) => ({ currencyCode: row.currencyCode, amountMinor: (row._sum.amountMinor ?? BigInt(0)).toString() })),
    invoicesByCurrency: invoicesByCurrency.map((row) => ({ currencyCode: row.currencyCode, status: row.status, amountMinor: (row._sum.amountMinor ?? BigInt(0)).toString(), count: row._count._all }))
  };
}

export async function listAdminAdInvoices(now = new Date()) {
  await (await import("@/server/identity/permission-guard")).requirePermission({ permissionKey: "ads:moderate", now });
  const rows = await prisma.adInvoice.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true, storeId: true, currencyCode: true, periodStart: true, periodEnd: true,
      amountMinor: true, status: true, paymentReference: true, settledAt: true, dueAt: true,
      currency: { select: { minorUnit: true } },
      store: { select: { id: true, name: true, slug: true } }
    }
  });
  return rows.map((row) => ({ ...row, amountMinor: row.amountMinor.toString() }));
}

export async function settleAdInvoice(id: string, paymentReference: string, now = new Date()) {
  const actor = await (await import("@/server/identity/permission-guard")).requirePermission({ permissionKey: "ads:moderate", now });
  const reference = paymentReference.trim();
  if (reference.length < 3 || reference.length > 180) throw new Error("A verified external payment reference is required.");
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.adInvoice.findUnique({ where: { id }, select: { id: true, status: true, storeId: true, amountMinor: true, currencyCode: true } });
    if (!invoice) throw new Error("Advertising invoice not found.");
    if (invoice.status !== AdInvoiceStatus.OPEN) throw new Error("Only open advertising invoices can be settled.");
    const updated = await tx.adInvoice.updateMany({
      where: { id, status: AdInvoiceStatus.OPEN },
      data: { status: AdInvoiceStatus.SETTLED, paymentReference: reference, settledAt: now, settledById: actor.userId }
    });
    if (updated.count !== 1) throw new Error("Invoice state changed; reload and try again.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "advertising.invoice.settled",
        resource: "ad_invoice", resourceId: id, scopeType: "STORE", scopeId: invoice.storeId,
        occurredAt: now, metadata: { paymentReference: reference, amountMinor: invoice.amountMinor.toString(), currencyCode: invoice.currencyCode }
      }
    });
    const result = await tx.adInvoice.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, paymentReference: true, settledAt: true, amountMinor: true, currencyCode: true, dueAt: true }
    });
    return { ...result, amountMinor: result.amountMinor.toString() };
  });
}
