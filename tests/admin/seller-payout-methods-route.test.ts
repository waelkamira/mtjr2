import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformManagement: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/identity/permission-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/identity/permission-guard")>()),
  requirePlatformManagement: mocks.requirePlatformManagement
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sellerPayoutMethod: { findMany: mocks.findMany, count: mocks.count },
    $transaction: mocks.transaction
  }
}));

import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { GET } from "@/app/api/admin/seller-payout-methods/route";

describe("admin seller payout destination listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it("requires platform management and returns only masked destination fields", async () => {
    const response = await GET(new Request("https://matjar.test/api/admin/seller-payout-methods"));
    expect(response.status).toBe(200);
    expect(mocks.requirePlatformManagement).toHaveBeenCalledOnce();
    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: "PENDING_VERIFICATION" });
    expect(query.select.encryptedDetails).toBeUndefined();
    expect(query.select.accountIdentifier).toBeUndefined();
    expect(query.select.accountLast4).toBe(true);
    expect(query.select.submittedAt).toBe(true);
    expect(query.orderBy).toEqual([{ submittedAt: "desc" }, { id: "asc" }]);
    expect(query.select.seller.select.owner.select.email).toBe(true);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("rejects unsupported statuses without querying the database", async () => {
    const response = await GET(new Request("https://matjar.test/api/admin/seller-payout-methods?status=DISABLED"));
    expect(response.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it.each(["1.5", "Infinity", "0"])("rejects invalid page value %s", async (page) => {
    const response = await GET(new Request(`https://matjar.test/api/admin/seller-payout-methods?page=${page}`));
    expect(response.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("allows page 1001 when the queue contains more than 50,000 destinations", async () => {
    mocks.count.mockResolvedValue(50001);
    const response = await GET(new Request("https://matjar.test/api/admin/seller-payout-methods?page=1001"));
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50000, take: 50 }));
    await expect(response.json()).resolves.toMatchObject({ page: 1001, pageCount: 1001, total: 50001 });
  });

  it("returns authentication and permission failures safely", async () => {
    mocks.requirePlatformManagement.mockRejectedValueOnce(new AuthenticationRequiredError());
    const unauthenticated = await GET(new Request("https://matjar.test/api/admin/seller-payout-methods"));
    expect(unauthenticated.status).toBe(401);

    mocks.requirePlatformManagement.mockRejectedValueOnce(new PermissionDeniedError("denied"));
    const forbidden = await GET(new Request("https://matjar.test/api/admin/seller-payout-methods"));
    expect(forbidden.status).toBe(403);
  });
});
