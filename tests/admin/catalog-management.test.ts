import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  transaction: vi.fn(),
  productCount: vi.fn(),
  productFindMany: vi.fn(),
  productUpdateMany: vi.fn(),
  auditCreateMany: vi.fn(),
  categoryFindUnique: vi.fn(),
  categoryCount: vi.fn(),
  categoryCreate: vi.fn(),
  categoryUpdate: vi.fn(),
  categoryUpdateMany: vi.fn(),
  categoryAuditCreate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    product: { count: vi.fn(), findMany: vi.fn() },
    category: { findMany: vi.fn() },
    $transaction: mocks.transaction
  }
}));

import {
  archiveAdminCategory,
  archiveAdminProducts,
  saveAdminCategory
} from "@/server/admin/catalog-management";

describe("admin bulk product archival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.productCount.mockResolvedValue(2);
    mocks.productFindMany.mockResolvedValue([
      { id: "p1", status: "ACTIVE", storeId: "s1" },
      { id: "p2", status: "DRAFT", storeId: "s1" }
    ]);
    mocks.productUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreateMany.mockResolvedValue({ count: 2 });
    mocks.categoryFindUnique.mockResolvedValue({ id: "parent-1", parentId: null, status: "ACTIVE" });
    mocks.categoryCount.mockResolvedValue(0);
    mocks.categoryCreate.mockResolvedValue({ id: "category-1", status: "ACTIVE", slug: "phones" });
    mocks.categoryUpdate.mockResolvedValue({ id: "category-1", status: "ACTIVE", slug: "phones" });
    mocks.categoryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.categoryAuditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({
      product: {
        count: mocks.productCount,
        findMany: mocks.productFindMany,
        updateMany: mocks.productUpdateMany
      },
      store: { findUnique: vi.fn().mockResolvedValue({ id: "s1" }) },
      seller: { findUnique: vi.fn().mockResolvedValue({ id: "seller-1" }) },
      category: {
        findUnique: mocks.categoryFindUnique,
        count: mocks.categoryCount,
        create: mocks.categoryCreate,
        update: mocks.categoryUpdate,
        updateMany: mocks.categoryUpdateMany
      },
      auditLog: { createMany: mocks.auditCreateMany, create: mocks.categoryAuditCreate }
    }));
  });

  it("archives a selected set atomically and writes one audit record per product", async () => {
    const now = new Date("2026-11-07T10:00:00.000Z");
    const result = await archiveAdminProducts({
      productIds: ["p1", "p2"],
      reason: "Policy violation confirmed"
    }, now);

    expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "catalog:manage", now });
    expect(mocks.productUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "p1", status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED" }
    });
    expect(mocks.productUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "p2", status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED" }
    });
    expect(mocks.auditCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          action: "catalog.product.archived",
          resourceId: "p1",
          metadata: expect.objectContaining({ reason: "Policy violation confirmed", bulk: true })
        }),
        expect.objectContaining({ resourceId: "p2" })
      ])
    });
    expect(result).toEqual({ archived: 2 });
  });

  it("audits only products whose archive transition actually won a concurrent update", async () => {
    mocks.productUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await archiveAdminProducts({
      productIds: ["p1", "p2"],
      reason: "Policy violation confirmed"
    });

    expect(result).toEqual({ archived: 1 });
    expect(mocks.auditCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        action: "catalog.product.archived",
        resourceId: "p1"
      })]
    });
  });

  it("rejects a scoped action that matches more than 500 products", async () => {
    mocks.productFindMany.mockResolvedValue(Array.from({ length: 501 }, (_, index) => ({
      id: `p${index}`,
      status: "ACTIVE",
      storeId: "s1"
    })));
    await expect(archiveAdminProducts({
      storeId: "s1",
      reason: "Policy violation confirmed"
    })).rejects.toThrow("Archive at most 500 products");
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreateMany).not.toHaveBeenCalled();
  });

  it("requires exactly one target scope and a reason", async () => {
    await expect(archiveAdminProducts({
      productIds: ["p1"],
      storeId: "s1",
      reason: "Policy violation confirmed"
    })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not allow an active category beneath a draft or archived ancestor", async () => {
    mocks.categoryFindUnique.mockResolvedValue({ id: "parent-1", parentId: null, status: "ARCHIVED" });
    await expect(saveAdminCategory({
      name: "Phones",
      slug: "phones",
      status: "ACTIVE",
      parentId: "parent-1",
      sortOrder: 0
    })).rejects.toThrow("active ancestors");
    expect(mocks.categoryCreate).not.toHaveBeenCalled();
  });

  it("requires active children to be archived before their parent", async () => {
    mocks.categoryFindUnique.mockResolvedValue({ id: "parent-1", slug: "electronics", status: "ACTIVE" });
    mocks.categoryCount.mockResolvedValue(1);
    await expect(archiveAdminCategory("parent-1", "Taxonomy consolidation"))
      .rejects.toThrow("Archive active child categories first");
    expect(mocks.categoryUpdateMany).not.toHaveBeenCalled();
  });
});
