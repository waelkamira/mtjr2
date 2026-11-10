import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  storeFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  productVariantFindMany: vi.fn(),
  productPriceFindMany: vi.fn(),
  inventoryFindMany: vi.fn(),
  auditLogCreate: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    store: { findUnique: mocks.storeFindUnique },
    product: { findMany: mocks.productFindMany },
    productVariant: { findMany: mocks.productVariantFindMany },
    productPrice: { findMany: mocks.productPriceFindMany },
    inventory: { findMany: mocks.inventoryFindMany },
    auditLog: { create: mocks.auditLogCreate }
  }
}));

import { GET } from "@/app/api/seller/stores/[storeId]/export/route";

const store = {
  id: "store-1", storeNumber: BigInt(10), name: "Demo shop", slug: "demo-shop",
  status: "ACTIVE", description: "A demo", publicPhone: null, publicAddress: null,
  shippingContactName: null, shippingPhone: null, shippingAddressLine1: null,
  shippingAddressLine2: null, shippingCity: null, shippingRegion: null,
  shippingPostalCode: null, shippingCountryCode: null, shippingInstructions: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  seller: {
    ownerId: "owner-1", legalName: null, displayName: "Owner", contactName: null,
    contactEmail: null, phoneNumber: null
  }
};

describe("seller store workbook export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "owner-1" });
    mocks.storeFindUnique.mockResolvedValue(store);
    mocks.productFindMany.mockResolvedValue([{
      id: "product-1", productNumber: BigInt(101), name: "<Desk & Lamp>", slug: "desk-lamp",
      description: null, status: "ACTIVE", approvalStatus: "APPROVED", city: null,
      district: null, streetAddress: null, createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    }]);
    mocks.productVariantFindMany.mockResolvedValue([]);
    mocks.productPriceFindMany.mockResolvedValue([]);
    mocks.inventoryFindMany.mockResolvedValue([]);
    mocks.auditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("exports only the authenticated owner's store and records an audit event", async () => {
    const response = await GET(new Request("https://matjar.example/api/seller/stores/store-1/export"), {
      params: Promise.resolve({ storeId: "store-1" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain("matjar-demo-shop-export.xls");
    expect(body).toContain("&lt;Desk &amp; Lamp&gt;");
    expect(body).not.toContain("buyer");
    expect(mocks.productFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5_001 }));
    expect(mocks.productVariantFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25_001 }));
    expect(mocks.inventoryFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 5_001,
      where: {
        warehouse: { is: { storeId: "store-1" } },
        variant: { is: { product: { is: { storeId: "store-1" } } } }
      }
    }));
    expect(mocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: "owner-1",
        action: "seller.store_export.downloaded",
        resourceId: "store-1"
      })
    }));
  });

  it("does not query or export another seller's store", async () => {
    mocks.storeFindUnique.mockResolvedValue({
      ...store,
      seller: { ...store.seller, ownerId: "different-owner" }
    });

    const response = await GET(new Request("https://matjar.example/api/seller/stores/store-1/export"), {
      params: Promise.resolve({ storeId: "store-1" })
    });

    expect(response.status).toBe(403);
    expect(mocks.productFindMany).not.toHaveBeenCalled();
    expect(mocks.productVariantFindMany).not.toHaveBeenCalled();
    expect(mocks.productPriceFindMany).not.toHaveBeenCalled();
    expect(mocks.inventoryFindMany).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});
