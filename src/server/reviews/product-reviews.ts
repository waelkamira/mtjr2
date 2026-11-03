import "server-only";

import { AuditActorType, CatalogEntityStatus, ProductApprovalStatus, ReviewStatus, VendorOrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/server/identity/current-session";
import { requirePermission } from "@/server/identity/permission-guard";

const reviewInputSchema = z.object({
  orderItemId: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(20).max(4000)
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
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER, actorId: actor.userId, action: "review.product.submitted",
          resource: "product_review", resourceId: review.id, scopeType: "PRODUCT", scopeId: id,
          occurredAt: now, metadata: { orderItemId: item.id, orderId: item.vendorOrder.orderId, rating: data.rating }
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
  return prisma.productReview.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: "desc" }, take: 50,
    select: {
      id: true, rating: true, title: true, body: true, status: true, createdAt: true,
      product: { select: { id: true, name: true, slug: true, media: { where: { isPrimary: true }, take: 1, select: { url: true } } } }
    }
  });
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
