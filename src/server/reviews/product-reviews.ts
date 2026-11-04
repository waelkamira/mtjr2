import "server-only";

import { AuditActorType, CatalogEntityStatus, ProductApprovalStatus, ReviewStatus, VendorOrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { isIP } from "node:net";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";
import { userHasScopedPermission } from "@/server/identity/permission-repository";

const reviewMediaUrlsSchema = z.array(z.string().trim().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username && !url.password
      && isIP(url.hostname.replace(/^\[|\]$/g, "")) === 0
      && url.hostname.includes(".") && !url.hostname.endsWith(".")
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$|(?:^|\.)example$/i.test(url.hostname)
      && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}, "Use a public HTTPS image URL ending in a supported image format."))
  .max(5)
  .default([])
  .superRefine((urls, context) => {
    if (new Set(urls).size !== urls.length) {
      context.addIssue({ code: "custom", message: "Review image URLs must be unique." });
    }
  });

const reviewInputSchema = z.object({
  orderItemId: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(20).max(4000),
  mediaUrls: reviewMediaUrlsSchema
}).strict();

const reviewPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().trim().min(1).optional()
});

export async function listPublicProductReviews(productId: string, query: unknown = {}) {
  const id = z.string().trim().min(1).parse(productId);
  const page = reviewPageSchema.parse(query);
  const product = await prisma.product.findFirst({
    where: { id, status: CatalogEntityStatus.ACTIVE, approvalStatus: ProductApprovalStatus.APPROVED, store: { status: "ACTIVE", seller: { status: "ACTIVE" } } },
    select: { id: true }
  });
  if (!product) throw new Error("Product not found.");
  const [items, aggregate, total] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId: id, status: ReviewStatus.PUBLISHED },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      select: {
        id: true, rating: true, title: true, body: true, createdAt: true,
        media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
        user: { select: { displayName: true } }
      }
    }),
    prisma.productReview.aggregate({
      where: { productId: id, status: ReviewStatus.PUBLISHED },
      _avg: { rating: true }, _count: { _all: true }
    }),
    prisma.productReview.count({ where: { productId: id, status: ReviewStatus.PUBLISHED } })
  ]);
  const hasMore = items.length > page.limit;
  const pageItems = hasMore ? items.slice(0, page.limit) : items;
  return {
    items: pageItems.map((item) => ({
      id: item.id, rating: item.rating, title: item.title, body: item.body,
      author: item.user.displayName?.trim() || "Verified buyer", createdAt: item.createdAt.toISOString(),
      media: item.media,
      verifiedPurchase: true as const
    })),
    summary: { averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all },
    nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null,
    total
  };
}

export async function listMyReviewableOrderItems(productId: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const actor = await requireCurrentSession(now);
  return prisma.orderItem.findMany({
    where: {
      productId: id, review: null,
      product: { reviews: { none: { userId: actor.userId } } },
      vendorOrder: { status: VendorOrderStatus.DELIVERED, order: { userId: actor.userId } }
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, productName: true, sku: true, quantity: true,
      vendorOrder: { select: { order: { select: { orderNumber: true, placedAt: true } } } }
    }
  }).then((items) => items.map((item) => ({
    id: item.id, productName: item.productName, sku: item.sku, quantity: item.quantity,
    orderNumber: item.vendorOrder.order.orderNumber, purchasedAt: item.vendorOrder.order.placedAt.toISOString()
  })));
}

export async function createVerifiedProductReview(productId: string, input: unknown, now = new Date()) {
  const id = z.string().trim().min(1).parse(productId);
  const data = reviewInputSchema.parse(input);
  const actor = await requireCurrentSession(now);
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: {
          id: data.orderItemId, productId: id,
          vendorOrder: { status: VendorOrderStatus.DELIVERED, order: { userId: actor.userId } }
        },
        select: { id: true, productName: true, vendorOrder: { select: { orderId: true } } }
      });
      if (!item) throw new Error("A delivered purchase of this product is required to write a review.");
      const review = await tx.productReview.create({
        data: {
          productId: id, userId: actor.userId, orderItemId: item.id,
          rating: data.rating, title: data.title, body: data.body, status: ReviewStatus.PENDING
        },
        select: { id: true, status: true, rating: true, title: true, createdAt: true }
      });
      if (data.mediaUrls.length) {
        await tx.reviewMedia.createMany({
          data: data.mediaUrls.map((url, position) => ({
            productReviewId: review.id, url, position, altText: "Customer review image"
          }))
        });
      }
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER, actorId: actor.userId, action: "review.product.submitted",
          resource: "product_review", resourceId: review.id, scopeType: "PRODUCT", scopeId: id,
          occurredAt: now, metadata: { orderItemId: item.id, orderId: item.vendorOrder.orderId, rating: data.rating, mediaCount: data.mediaUrls.length }
        }
      });
      return { ...review, createdAt: review.createdAt.toISOString() };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("You have already reviewed this product.");
    }
    throw error;
  }
}

export async function listMyProductReviews(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const [productItems, storeItems] = await Promise.all([
    prisma.productReview.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" }, take: 50,
      select: {
        id: true, rating: true, title: true, body: true, status: true, createdAt: true,
        product: { select: { id: true, name: true, slug: true, media: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
        media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
        appeals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } }
      }
    }),
    prisma.storeReview.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" }, take: 50,
      select: {
        id: true, rating: true, title: true, body: true, status: true, sellerResponse: true, createdAt: true,
        media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
        appeals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
        store: { select: { id: true, name: true, slug: true } },
        vendorOrder: { select: { order: { select: { orderNumber: true } } } }
      }
    })
  ]);
  return { productItems, storeItems };
}

export async function listPendingProductReviews(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  return prisma.productReview.findMany({
    where: { status: ReviewStatus.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    select: {
      id: true, rating: true, title: true, body: true, createdAt: true,
      product: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, displayName: true, email: true } },
      media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
      orderItem: { select: { id: true, sku: true, quantity: true, vendorOrder: { select: { order: { select: { orderNumber: true } } } } } }
    }
  });
}

export async function moderateProductReview(reviewId: string, decision: "PUBLISH" | "REJECT" | "HIDE", reason?: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(reviewId);
  const note = reason?.trim().slice(0, 500);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  const nextStatus = decision === "PUBLISH" ? ReviewStatus.PUBLISHED : decision === "REJECT" ? ReviewStatus.REJECTED : ReviewStatus.HIDDEN;
  return prisma.$transaction(async (tx) => {
    const review = await tx.productReview.findUnique({ where: { id }, select: { id: true, productId: true, status: true } });
    if (!review) throw new Error("Review not found.");
    if (review.status !== ReviewStatus.PENDING && decision !== "HIDE") throw new Error("Only pending reviews can be approved or rejected.");
    const changed = await tx.productReview.updateMany({
      where: { id, status: review.status },
      data: { status: nextStatus, moderatedAt: now, moderatedBy: actor.userId }
    });
    if (changed.count !== 1) throw new Error("Review was already moderated.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: `review.product.${decision.toLowerCase()}`,
        resource: "product_review", resourceId: id, scopeType: "PRODUCT", scopeId: review.productId,
        occurredAt: now, metadata: { previousStatus: review.status, status: nextStatus, reason: note ?? null }
      }
    });
    return { reviewId: id, status: nextStatus };
  });
}


const storeReviewInputSchema = reviewInputSchema.extend({ vendorOrderId: z.string().trim().min(1) }).strict();

export async function listPublicStoreReviews(storeId: string, query: unknown = {}) {
  const id = z.string().trim().min(1).parse(storeId);
  const page = reviewPageSchema.parse(query);
  const store = await prisma.store.findFirst({
    where: { id, status: "ACTIVE", seller: { status: "ACTIVE" } }, select: { id: true }
  });
  if (!store) throw new Error("Store not found.");
  const [items, aggregate] = await Promise.all([
    prisma.storeReview.findMany({
      where: { storeId: id, status: ReviewStatus.PUBLISHED },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      select: {
        id: true, rating: true, title: true, body: true, sellerResponse: true, sellerRespondedAt: true, createdAt: true,
        media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
        user: { select: { displayName: true } }
      }
    }),
    prisma.storeReview.aggregate({
      where: { storeId: id, status: ReviewStatus.PUBLISHED }, _avg: { rating: true }, _count: { _all: true }
    })
  ]);
  const hasMore = items.length > page.limit;
  const pageItems = hasMore ? items.slice(0, page.limit) : items;
  return {
    items: pageItems.map((item) => ({
      id: item.id, rating: item.rating, title: item.title, body: item.body,
      author: item.user.displayName?.trim() || "Verified buyer",
      media: item.media,
      sellerResponse: item.sellerResponse,
      sellerRespondedAt: item.sellerRespondedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(), verifiedPurchase: true as const
    })),
    summary: { averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all },
    nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null
  };
}

export async function createVerifiedStoreReview(storeId: string, input: unknown, now = new Date()) {
  const id = z.string().trim().min(1).parse(storeId);
  const data = storeReviewInputSchema.parse(input);
  const actor = await requireCurrentSession(now);
  try {
    return await prisma.$transaction(async (tx) => {
      const vendorOrder = await tx.vendorOrder.findFirst({
        where: {
          id: data.vendorOrderId, storeId: id, status: VendorOrderStatus.DELIVERED,
          order: { userId: actor.userId }
        },
        select: { id: true, orderId: true }
      });
      if (!vendorOrder) throw new Error("A delivered purchase from this store is required to write a review.");
      const review = await tx.storeReview.create({
        data: {
          storeId: id, userId: actor.userId, vendorOrderId: vendorOrder.id,
          rating: data.rating, title: data.title, body: data.body, status: ReviewStatus.PENDING
        },
        select: { id: true, status: true, rating: true, title: true, createdAt: true }
      });
      if (data.mediaUrls.length) {
        await tx.reviewMedia.createMany({
          data: data.mediaUrls.map((url, position) => ({
            storeReviewId: review.id, url, position, altText: "Customer review image"
          }))
        });
      }
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER, actorId: actor.userId, action: "review.store.submitted",
          resource: "store_review", resourceId: review.id, scopeType: "STORE", scopeId: id,
          occurredAt: now, metadata: { vendorOrderId: vendorOrder.id, orderId: vendorOrder.orderId, rating: data.rating, mediaCount: data.mediaUrls.length }
        }
      });
      return { ...review, createdAt: review.createdAt.toISOString() };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("You have already reviewed this store.");
    }
    throw error;
  }
}

export async function listPendingStoreReviews(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  return prisma.storeReview.findMany({
    where: { status: ReviewStatus.PENDING },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    select: {
      id: true, rating: true, title: true, body: true, createdAt: true,
      media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
      store: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, displayName: true, email: true } },
      vendorOrder: { select: { id: true, order: { select: { orderNumber: true } } } }
    }
  });
}

export async function moderateStoreReview(reviewId: string, decision: "PUBLISH" | "REJECT" | "HIDE", reason?: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(reviewId);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const review = await tx.storeReview.findUnique({ where: { id }, select: { id: true, storeId: true, status: true } });
    if (!review) throw new Error("Store review not found.");
    if (review.status !== ReviewStatus.PENDING && decision !== "HIDE") throw new Error("Only pending reviews can be approved or rejected.");
    const nextStatus = decision === "PUBLISH" ? ReviewStatus.PUBLISHED : decision === "REJECT" ? ReviewStatus.REJECTED : ReviewStatus.HIDDEN;
    const changed = await tx.storeReview.updateMany({
      where: { id, status: review.status },
      data: { status: nextStatus, moderatedAt: now, moderatedBy: actor.userId }
    });
    if (changed.count !== 1) throw new Error("Store review was already moderated.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: `review.store.${decision.toLowerCase()}`,
        resource: "store_review", resourceId: id, scopeType: "STORE", scopeId: review.storeId,
        occurredAt: now, metadata: { previousStatus: review.status, status: nextStatus, reason: reason?.trim().slice(0, 500) ?? null }
      }
    });
    return { reviewId: id, status: nextStatus };
  });
}

export async function listSellerStoreReviews(now = new Date()) {
  const actor = await requireCurrentSession(now);
  const stores = await prisma.store.findMany({
    where: {
      status: "ACTIVE",
      seller: { status: "ACTIVE" },
      OR: [
        { seller: { ownerId: actor.userId } },
        { staff: { some: { userId: actor.userId, status: "ACTIVE" } } }
      ]
    },
    select: { id: true, seller: { select: { ownerId: true } } }
  });
  const allowedStoreIds = (await Promise.all(stores.map(async (store) =>
    store.seller.ownerId === actor.userId || await userHasScopedPermission(actor.userId, {
      permissionKey: "reviews:manage", scope: { type: "STORE", id: store.id }, now
    }) ? store.id : null
  ))).filter((storeId): storeId is string => storeId !== null);
  if (!allowedStoreIds.length) return [];
  return prisma.storeReview.findMany({
    where: { storeId: { in: allowedStoreIds } },
    orderBy: { createdAt: "desc" }, take: 100,
    select: {
      id: true, rating: true, title: true, body: true, status: true, sellerResponse: true,
      sellerRespondedAt: true, createdAt: true,
      media: { orderBy: { position: "asc" }, select: { id: true, url: true, altText: true, position: true } },
      store: { select: { id: true, name: true, slug: true } },
      user: { select: { displayName: true } },
      vendorOrder: { select: { order: { select: { orderNumber: true } } } }
    }
  });
}

export async function respondToStoreReview(reviewId: string, responseText: string, now = new Date()) {
  const id = z.string().trim().min(1).parse(reviewId);
  const body = z.string().trim().min(3).max(2000).parse(responseText);
  const actor = await requireCurrentSession(now);
  return prisma.$transaction(async (tx) => {
    const review = await tx.storeReview.findFirst({
      where: { id, status: ReviewStatus.PUBLISHED, store: { status: "ACTIVE", seller: { status: "ACTIVE" } } },
      select: { id: true, storeId: true, store: { select: { seller: { select: { ownerId: true } } } } }
    });
    if (!review) throw new Error("Published store review not found for your store.");
    if (review.store.seller.ownerId !== actor.userId) {
      const activeStaff = await tx.sellerStaff.findFirst({
        where: { storeId: review.storeId, userId: actor.userId, status: "ACTIVE" }, select: { id: true }
      });
      const authorized = activeStaff && await userHasScopedPermission(actor.userId, {
        permissionKey: "reviews:manage", scope: { type: "STORE", id: review.storeId }, now
      });
      if (!authorized) throw new Error("You do not have permission to respond to reviews for this store.");
    }
    const updated = await tx.storeReview.update({
      where: { id }, data: { sellerResponse: body, sellerRespondedAt: now },
      select: { id: true, sellerResponse: true, sellerRespondedAt: true }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "review.store.seller_responded",
        resource: "store_review", resourceId: id, scopeType: "STORE", scopeId: review.storeId, occurredAt: now
      }
    });
    return { ...updated, sellerRespondedAt: updated.sellerRespondedAt?.toISOString() ?? null };
  });
}

const reviewReportInputSchema = z.object({
  reason: z.enum(["INAPPROPRIATE", "SPAM", "FAKE", "CONFLICT_OF_INTEREST", "PERSONAL_INFORMATION", "OTHER"]),
  details: z.string().trim().max(1000).optional()
}).strict();

const reviewAppealInputSchema = z.object({
  reason: z.string().trim().min(20).max(2000)
}).strict();

type ReviewKind = "PRODUCT" | "STORE";

export async function createReviewReport(kind: ReviewKind, parentId: string, reviewId: string, input: unknown, now = new Date()) {
  const parent = z.string().trim().min(1).parse(parentId);
  const id = z.string().trim().min(1).parse(reviewId);
  const data = reviewReportInputSchema.parse(input);
  const actor = await requireCurrentSession(now);
  try {
    return await prisma.$transaction(async (tx) => {
      const review = kind === "PRODUCT"
        ? await tx.productReview.findFirst({ where: { id, productId: parent, status: ReviewStatus.PUBLISHED }, select: { id: true, userId: true, productId: true } })
        : await tx.storeReview.findFirst({ where: { id, storeId: parent, status: ReviewStatus.PUBLISHED }, select: { id: true, userId: true, storeId: true } });
      if (!review) throw new Error("Published review not found.");
      if (review.userId === actor.userId) throw new Error("You cannot report your own review.");
      const report = await tx.reviewReport.create({
        data: {
          reporterId: actor.userId,
          reason: data.reason,
          details: data.details || null,
          ...(kind === "PRODUCT" ? { productReviewId: id } : { storeReviewId: id })
        },
        select: { id: true, status: true, reason: true, createdAt: true }
      });
      const scopeId = "productId" in review ? review.productId : review.storeId;
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER, actorId: actor.userId, action: `review.${kind.toLowerCase()}.reported`,
          resource: "review_report", resourceId: report.id,
          scopeType: kind, scopeId,
          occurredAt: now, metadata: { reviewId: id, reason: data.reason }
        }
      });
      return { ...report, createdAt: report.createdAt.toISOString() };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("You have already reported this review.");
    }
    throw error;
  }
}

export async function createReviewAppeal(kind: ReviewKind, reviewId: string, input: unknown, now = new Date()) {
  const id = z.string().trim().min(1).parse(reviewId);
  const data = reviewAppealInputSchema.parse(input);
  const actor = await requireCurrentSession(now);
  try {
    return await prisma.$transaction(async (tx) => {
      const review = kind === "PRODUCT"
        ? await tx.productReview.findUnique({ where: { id }, select: { id: true, userId: true, status: true, productId: true } })
        : await tx.storeReview.findUnique({ where: { id }, select: { id: true, userId: true, status: true, storeId: true } });
      if (!review || review.userId !== actor.userId) throw new Error("Review not found.");
      if (review.status !== ReviewStatus.REJECTED && review.status !== ReviewStatus.HIDDEN) {
        throw new Error("Only a rejected or hidden review can be appealed.");
      }
      const appeal = await tx.reviewAppeal.create({
        data: {
          authorId: actor.userId, reason: data.reason,
          ...(kind === "PRODUCT" ? { productReviewId: id } : { storeReviewId: id })
        },
        select: { id: true, status: true, reason: true, createdAt: true }
      });
      const scopeId = "productId" in review ? review.productId : review.storeId;
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER, actorId: actor.userId, action: `review.${kind.toLowerCase()}.appealed`,
          resource: "review_appeal", resourceId: appeal.id, scopeType: kind,
          scopeId, occurredAt: now, metadata: { reviewId: id, previousStatus: review.status }
        }
      });
      return { ...appeal, createdAt: appeal.createdAt.toISOString() };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("An appeal has already been submitted for this review.");
    }
    throw error;
  }
}

export async function listPendingReviewReports(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  const reports = await prisma.reviewReport.findMany({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    select: {
      id: true, reason: true, details: true, createdAt: true,
      reporter: { select: { id: true, displayName: true, email: true } },
      productReview: { select: { id: true, title: true, body: true, status: true, product: { select: { id: true, name: true, slug: true } }, user: { select: { displayName: true, email: true } } } },
      storeReview: { select: { id: true, title: true, body: true, status: true, store: { select: { id: true, name: true, slug: true } }, user: { select: { displayName: true, email: true } } } }
    }
  });
  return reports.map((report) => ({
    id: report.id, reason: report.reason, details: report.details, createdAt: report.createdAt.toISOString(),
    reporter: report.reporter,
    review: report.productReview
      ? { kind: "PRODUCT" as const, ...report.productReview }
      : report.storeReview ? { kind: "STORE" as const, ...report.storeReview } : null
  }));
}

export async function listPendingReviewAppeals(now = new Date()) {
  await requirePermission({ permissionKey: "users:manage", now });
  const appeals = await prisma.reviewAppeal.findMany({
    where: { status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    select: {
      id: true, reason: true, createdAt: true,
      author: { select: { id: true, displayName: true, email: true } },
      productReview: { select: { id: true, title: true, body: true, status: true, product: { select: { id: true, name: true, slug: true } } } },
      storeReview: { select: { id: true, title: true, body: true, status: true, store: { select: { id: true, name: true, slug: true } } } }
    }
  });
  return appeals.map((appeal) => ({
    id: appeal.id, reason: appeal.reason, createdAt: appeal.createdAt.toISOString(), author: appeal.author,
    review: appeal.productReview
      ? { kind: "PRODUCT" as const, ...appeal.productReview }
      : appeal.storeReview ? { kind: "STORE" as const, ...appeal.storeReview } : null
  }));
}

export async function resolveReviewReport(
  reportId: string,
  decision: "DISMISS" | "HIDE",
  reason: string,
  now = new Date()
) {
  const id = z.string().trim().min(1).parse(reportId);
  const note = z.string().trim().min(3).max(500).parse(reason);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const report = await tx.reviewReport.findUnique({
      where: { id },
      select: {
        id: true, status: true, productReviewId: true, storeReviewId: true,
        productReview: { select: { id: true, status: true, productId: true } },
        storeReview: { select: { id: true, status: true, storeId: true } }
      }
    });
    if (!report) throw new Error("Review report not found.");
    if (report.status !== "PENDING") throw new Error("Review report was already resolved.");
    if (decision === "HIDE") {
      if (report.productReview?.status === ReviewStatus.PUBLISHED) {
        const changed = await tx.productReview.updateMany({
          where: { id: report.productReview.id, status: ReviewStatus.PUBLISHED },
          data: { status: ReviewStatus.HIDDEN, moderatedAt: now, moderatedBy: actor.userId }
        });
        if (changed.count !== 1) throw new Error("Review changed while the report was being resolved.");
      } else if (report.storeReview?.status === ReviewStatus.PUBLISHED) {
        const changed = await tx.storeReview.updateMany({
          where: { id: report.storeReview.id, status: ReviewStatus.PUBLISHED },
          data: { status: ReviewStatus.HIDDEN, moderatedAt: now, moderatedBy: actor.userId }
        });
        if (changed.count !== 1) throw new Error("Review changed while the report was being resolved.");
      }
    }
    const updated = await tx.reviewReport.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: decision === "HIDE" ? "ACTIONED" : "DISMISSED",
        resolutionNote: note, resolvedBy: actor.userId, resolvedAt: now
      }
    });
    if (updated.count !== 1) throw new Error("Review report was already resolved.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: `review.report.${decision.toLowerCase()}`,
        resource: "review_report", resourceId: id,
        scopeType: report.productReviewId ? "PRODUCT" : "STORE",
        scopeId: report.productReview?.productId ?? report.storeReview?.storeId ?? id,
        occurredAt: now, metadata: { reviewId: report.productReviewId ?? report.storeReviewId, note }
      }
    });
    return { reportId: id, status: decision === "HIDE" ? "ACTIONED" : "DISMISSED" };
  });
}

export async function resolveReviewAppeal(
  appealId: string,
  decision: "UPHOLD" | "RESTORE",
  reason: string,
  now = new Date()
) {
  const id = z.string().trim().min(1).parse(appealId);
  const note = z.string().trim().min(3).max(500).parse(reason);
  const actor = await requirePermission({ permissionKey: "users:manage", now });
  return prisma.$transaction(async (tx) => {
    const appeal = await tx.reviewAppeal.findUnique({
      where: { id },
      select: {
        id: true, status: true, productReviewId: true, storeReviewId: true,
        productReview: { select: { id: true, productId: true, status: true } },
        storeReview: { select: { id: true, storeId: true, status: true } }
      }
    });
    if (!appeal) throw new Error("Review appeal not found.");
    if (appeal.status !== "PENDING") throw new Error("Review appeal was already resolved.");
    const reviewStatus = appeal.productReview?.status ?? appeal.storeReview?.status;
    if (decision === "UPHOLD" && reviewStatus !== ReviewStatus.HIDDEN && reviewStatus !== ReviewStatus.REJECTED) {
      throw new Error("Review status changed while the appeal was pending.");
    }
    if (decision === "RESTORE") {
      if (appeal.productReview && (appeal.productReview.status === ReviewStatus.HIDDEN || appeal.productReview.status === ReviewStatus.REJECTED)) {
        const changed = await tx.productReview.updateMany({
          where: { id: appeal.productReview.id, status: appeal.productReview.status },
          data: { status: ReviewStatus.PUBLISHED, moderatedAt: now, moderatedBy: actor.userId }
        });
        if (changed.count !== 1) throw new Error("Review changed while the appeal was being resolved.");
      } else if (appeal.storeReview && (appeal.storeReview.status === ReviewStatus.HIDDEN || appeal.storeReview.status === ReviewStatus.REJECTED)) {
        const changed = await tx.storeReview.updateMany({
          where: { id: appeal.storeReview.id, status: appeal.storeReview.status },
          data: { status: ReviewStatus.PUBLISHED, moderatedAt: now, moderatedBy: actor.userId }
        });
        if (changed.count !== 1) throw new Error("Review changed while the appeal was being resolved.");
      } else {
        throw new Error("Review status no longer permits restoration.");
      }
    }
    const updated = await tx.reviewAppeal.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: decision === "RESTORE" ? "RESTORED" : "UPHELD",
        resolutionNote: note, resolvedBy: actor.userId, resolvedAt: now
      }
    });
    if (updated.count !== 1) throw new Error("Review appeal was already resolved.");
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: `review.appeal.${decision.toLowerCase()}`,
        resource: "review_appeal", resourceId: id,
        scopeType: appeal.productReviewId ? "PRODUCT" : "STORE",
        scopeId: appeal.productReview?.productId ?? appeal.storeReview?.storeId ?? id,
        occurredAt: now, metadata: { reviewId: appeal.productReviewId ?? appeal.storeReviewId, note }
      }
    });
    return { appealId: id, status: decision === "RESTORE" ? "RESTORED" : "UPHELD" };
  });
}
