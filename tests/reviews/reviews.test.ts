import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  requirePermission: vi.fn(),
  userHasScopedPermission: vi.fn(),
  transaction: vi.fn(),
  productFindFirst: vi.fn(),
  productCreate: vi.fn(),
  productFindUnique: vi.fn(),
  productUpdateMany: vi.fn(),
  storeReviewFindFirst: vi.fn(),
  storeReviewFindUnique: vi.fn(),
  storeReviewUpdate: vi.fn(),
  storeReviewUpdateMany: vi.fn(),
  storeFindMany: vi.fn(),
  sellerStaffFindFirst: vi.fn(),
  reviewMediaCreateMany: vi.fn(),
  reportCreate: vi.fn(),
  reportFindUnique: vi.fn(),
  reportUpdateMany: vi.fn(),
  appealCreate: vi.fn(),
  appealFindUnique: vi.fn(),
  appealUpdateMany: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/identity/permission-repository", () => ({ userHasScopedPermission: mocks.userHasScopedPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    store: { findMany: mocks.storeFindMany }
  }
}));

import {
  createReviewAppeal,
  createReviewReport,
  createVerifiedProductReview,
  resolveReviewAppeal,
  resolveReviewReport,
  respondToStoreReview
} from "@/server/reviews/product-reviews";

describe("review media, reports, appeals, and seller responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "buyer-1" });
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.userHasScopedPermission.mockResolvedValue(true);
    mocks.productFindFirst.mockResolvedValue({
      id: "review-1", userId: "author-1", productId: "product-1", productName: "Product",
      vendorOrder: { orderId: "order-1" }
    });
    mocks.productCreate.mockResolvedValue({ id: "review-1", status: "PENDING", rating: 5, title: "Great", createdAt: new Date("2026-11-05T00:00:00Z") });
    mocks.productFindUnique.mockResolvedValue({ id: "review-1", userId: "buyer-1", productId: "product-1", status: "REJECTED" });
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });
    mocks.storeReviewFindFirst.mockResolvedValue({
      id: "store-review-1", storeId: "store-1", store: { seller: { ownerId: "owner-1" } }
    });
    mocks.storeReviewFindUnique.mockResolvedValue({ id: "store-review-1", userId: "author-1", status: "PUBLISHED" });
    mocks.storeReviewUpdate.mockResolvedValue({ id: "store-review-1", sellerResponse: "Thanks.", sellerRespondedAt: new Date("2026-11-05T00:00:00Z") });
    mocks.storeReviewUpdateMany.mockResolvedValue({ count: 1 });
    mocks.storeFindMany.mockResolvedValue([]);
    mocks.sellerStaffFindFirst.mockResolvedValue({ id: "staff-membership-1" });
    mocks.reviewMediaCreateMany.mockResolvedValue({ count: 1 });
    mocks.reportCreate.mockResolvedValue({ id: "report-1", status: "PENDING", reason: "SPAM", createdAt: new Date("2026-11-05T00:00:00Z") });
    mocks.reportFindUnique.mockResolvedValue({
      id: "report-1", status: "PENDING", productReviewId: "review-1", storeReviewId: null,
      productReview: { id: "review-1", status: "PUBLISHED", productId: "product-1" }, storeReview: null
    });
    mocks.reportUpdateMany.mockResolvedValue({ count: 1 });
    mocks.appealCreate.mockResolvedValue({ id: "appeal-1", status: "PENDING", reason: "The decision was mistaken.", createdAt: new Date("2026-11-05T00:00:00Z") });
    mocks.appealFindUnique.mockResolvedValue({
      id: "appeal-1", status: "PENDING", productReviewId: "review-1", storeReviewId: null,
      productReview: { id: "review-1", productId: "product-1", status: "REJECTED" }, storeReview: null
    });
    mocks.appealUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      orderItem: { findFirst: mocks.productFindFirst },
      productReview: { findFirst: mocks.productFindFirst, create: mocks.productCreate, findUnique: mocks.productFindUnique, updateMany: mocks.productUpdateMany },
      storeReview: { findFirst: mocks.storeReviewFindFirst, findUnique: mocks.storeReviewFindUnique, update: mocks.storeReviewUpdate, updateMany: mocks.storeReviewUpdateMany },
      sellerStaff: { findFirst: mocks.sellerStaffFindFirst },
      reviewMedia: { createMany: mocks.reviewMediaCreateMany },
      reviewReport: { create: mocks.reportCreate, findUnique: mocks.reportFindUnique, updateMany: mocks.reportUpdateMany },
      reviewAppeal: { create: mocks.appealCreate, findUnique: mocks.appealFindUnique, updateMany: mocks.appealUpdateMany },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects unsafe review image URLs before opening a transaction", async () => {
    await expect(createVerifiedProductReview("product-1", {
      orderItemId: "item-1", rating: 5, title: "Great item", body: "A sufficiently long review body.",
      mediaUrls: ["http://example.com/image.jpg"]
    })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates verified product review media in the same transaction", async () => {
    await createVerifiedProductReview("product-1", {
      orderItemId: "item-1", rating: 5, title: "Great item", body: "A sufficiently long review body.",
      mediaUrls: ["https://cdn.example.com/image.webp?size=large"]
    });
    expect(mocks.reviewMediaCreateMany).toHaveBeenCalledWith({
      data: [{ productReviewId: "review-1", url: "https://cdn.example.com/image.webp?size=large", position: 0, altText: "Customer review image" }]
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("preserves review submissions when no images are supplied", async () => {
    await createVerifiedProductReview("product-1", {
      orderItemId: "item-1", rating: 4, title: "Good item", body: "A sufficiently long review body."
    });
    expect(mocks.reviewMediaCreateMany).not.toHaveBeenCalled();
    expect(mocks.productCreate).toHaveBeenCalledOnce();
  });

  it("accepts reports only for another user's published review in the requested product", async () => {
    mocks.productFindFirst.mockResolvedValueOnce(null);
    await expect(createReviewReport("PRODUCT", "other-product", "review-1", { reason: "SPAM" })).rejects.toThrow(/published review/i);
    mocks.productFindFirst.mockResolvedValueOnce({ id: "review-1", userId: "author-1", productId: "product-1" });
    const report = await createReviewReport("PRODUCT", "product-1", "review-1", { reason: "SPAM", details: "This appears duplicated." });
    expect(report.status).toBe("PENDING");
    expect(mocks.reportCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reporterId: "buyer-1", productReviewId: "review-1", reason: "SPAM" })
    }));
  });

  it("does not allow review authors to report their own review", async () => {
    mocks.productFindFirst.mockResolvedValueOnce({ id: "review-1", userId: "buyer-1", productId: "product-1" });
    await expect(createReviewReport("PRODUCT", "product-1", "review-1", { reason: "SPAM" })).rejects.toThrow(/own review/i);
    expect(mocks.reportCreate).not.toHaveBeenCalled();
  });

  it("allows only the author to appeal a rejected or hidden review", async () => {
    mocks.productFindUnique.mockResolvedValueOnce({ id: "review-1", userId: "another-user", status: "REJECTED" });
    await expect(createReviewAppeal("PRODUCT", "review-1", { reason: "I believe the moderation decision was mistaken." })).rejects.toThrow(/not found/i);
    mocks.productFindUnique.mockResolvedValueOnce({ id: "review-1", userId: "buyer-1", status: "REJECTED", productId: "product-1" });
    await createReviewAppeal("PRODUCT", "review-1", { reason: "I believe the moderation decision was mistaken." });
    expect(mocks.appealCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ authorId: "buyer-1", productReviewId: "review-1" })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scopeType: "PRODUCT", scopeId: "product-1" })
    }));
  });

  it("hides reported reviews and records the moderator's audited resolution", async () => {
    const result = await resolveReviewReport("report-1", "HIDE", "Policy violation confirmed.");
    expect(result.status).toBe("ACTIONED");
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "review-1", status: "PUBLISHED" }, data: expect.objectContaining({ status: "HIDDEN", moderatedBy: "admin-1" })
    }));
    expect(mocks.reportUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIONED", resolvedBy: "admin-1" }) }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("restores an appealed review and records the moderator's audited resolution", async () => {
    const result = await resolveReviewAppeal("appeal-1", "RESTORE", "The review follows policy.");
    expect(result.status).toBe("RESTORED");
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "review-1", status: "REJECTED" }, data: expect.objectContaining({ status: "PUBLISHED", moderatedBy: "admin-1" })
    }));
    expect(mocks.appealUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RESTORED", resolvedBy: "admin-1" }) }));
  });

  it("rejects an appeal decision when another moderator already changed the review status", async () => {
    mocks.appealFindUnique.mockResolvedValueOnce({
      id: "appeal-1", status: "PENDING", productReviewId: "review-1", storeReviewId: null,
      productReview: { id: "review-1", productId: "product-1", status: "PUBLISHED" }, storeReview: null
    });
    await expect(resolveReviewAppeal("appeal-1", "UPHOLD", "The earlier decision stands.")).rejects.toThrow(/status changed/i);
    expect(mocks.appealUpdateMany).not.toHaveBeenCalled();
  });

  it("permits an active store-scoped review manager to respond but rejects other staff", async () => {
    await respondToStoreReview("store-review-1", "Thanks.");
    expect(mocks.userHasScopedPermission).toHaveBeenCalledWith("buyer-1", {
      permissionKey: "reviews:manage", scope: { type: "STORE", id: "store-1" }, now: expect.any(Date)
    });
    mocks.userHasScopedPermission.mockResolvedValueOnce(false);
    await expect(respondToStoreReview("store-review-1", "No permission.")).rejects.toThrow(/permission to respond/i);
    expect(mocks.storeReviewUpdate).toHaveBeenCalledOnce();
  });
});
