import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), stepUp: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { userRoleAssignment: { findMany: mocks.findMany } } }));
vi.mock("@/server/identity/platform-session-policy", () => ({ requirePlatformSessionStepUp: mocks.stepUp }));

import { userHasAnyPermission, userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";

const now = new Date("2026-11-07T12:00:00.000Z");
const platformAdmin = [{
  scopeType: "GLOBAL", scopeId: "GLOBAL", expiresAt: null,
  role: { permissions: [
    { permission: { key: "platform:manage" } },
    { permission: { key: "catalog:manage" } }
  ] }
}];

describe("platform admin permission step-up enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue(platformAdmin);
    mocks.stepUp.mockResolvedValue({ id: "session-1", userId: "admin-1" });
  });

  it("requires step-up even when checking a non-platform permission", async () => {
    await expect(userHasPermission("admin-1", { permissionKey: "catalog:manage", now })).resolves.toBe(true);
    expect(mocks.stepUp).toHaveBeenCalledWith("admin-1", now);
  });

  it("requires step-up for any-of and scoped permission checks too", async () => {
    await expect(userHasAnyPermission("admin-1", [{ permissionKey: "catalog:manage" }], now)).resolves.toBe(true);
    await expect(userHasScopedPermission("admin-1", { permissionKey: "catalog:manage", scope: { type: "STORE", id: "store-1" }, now })).resolves.toBe(false);
    expect(mocks.stepUp).toHaveBeenCalledTimes(2);
  });

  it("does not require platform step-up for ordinary accounts", async () => {
    mocks.findMany.mockResolvedValueOnce([{
      scopeType: "GLOBAL", scopeId: "GLOBAL", expiresAt: null,
      role: { permissions: [{ permission: { key: "catalog:manage" } }] }
    }]);
    await expect(userHasPermission("seller-1", { permissionKey: "catalog:manage", now })).resolves.toBe(true);
    expect(mocks.stepUp).not.toHaveBeenCalled();
  });
});
