import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requestFindUnique: vi.fn(),
  requestUpdateMany: vi.fn(),
  itemUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/identity/permission-guard", () => ({ requirePermission: mocks.requirePermission }));

import { reviewReturnRequest } from "@/server/returns/returns";

describe("admin return decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.requestFindUnique.mockResolvedValue({ id: "return-1", status: "REQUESTED" });
    mocks.requestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.itemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    const tx = {
      returnRequest: { findUnique: mocks.requestFindUnique, updateMany: mocks.requestUpdateMany },
      returnItem: { updateMany: mocks.itemUpdateMany },
      auditLog: { create: mocks.auditCreate }
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("allows an administrator to approve pending lines", async () => {
    const result = await reviewReturnRequest("return-1", { status: "APPROVED", note: "Eligible" });

    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { returnRequestId: "return-1", status: "REQUESTED" },
      data: expect.objectContaining({ status: "APPROVED", reviewNote: "Eligible" })
    }));
    expect(result).toEqual({ id: "return-1", status: "APPROVED" });
  });

  it("does not let the admin endpoint mark a return received without a warehouse movement", async () => {
    await expect(reviewReturnRequest("return-1", { status: "RECEIVED" }))
      .rejects.toThrow();
    expect(mocks.requestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
