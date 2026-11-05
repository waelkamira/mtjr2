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

describe("admin return receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.requestFindUnique.mockResolvedValue({ id: "return-1", status: "APPROVED" });
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

  it("marks only approved lines received and preserves rejected lines", async () => {
    const result = await reviewReturnRequest("return-1", { status: "RECEIVED", note: "Package inspected" });

    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { returnRequestId: "return-1", status: "APPROVED" },
      data: expect.objectContaining({ status: "RECEIVED", reviewNote: "Package inspected" })
    }));
    expect(result).toEqual({ id: "return-1", status: "RECEIVED" });
  });

  it("does not mark the parent received when no approved lines remain to receive", async () => {
    mocks.itemUpdateMany.mockResolvedValue({ count: 0 });

    await expect(reviewReturnRequest("return-1", { status: "RECEIVED" }))
      .rejects.toThrow("There are no approved return items awaiting receipt.");
    expect(mocks.requestUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
