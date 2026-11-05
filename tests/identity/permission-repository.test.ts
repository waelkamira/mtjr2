import { beforeEach, describe, expect, it, vi } from "vitest";

const { assignmentsMock, stepUpMock } = vi.hoisted(() => ({
  assignmentsMock: vi.fn(),
  stepUpMock: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { userRoleAssignment: { findMany: assignmentsMock } }
}));
vi.mock("@/server/identity/platform-session-policy", () => ({
  requirePlatformSessionStepUp: stepUpMock
}));

import {
  userHasAnyPermission,
  userHasPermission,
  userHasScopedPermission
} from "@/server/identity/permission-repository";

const now = new Date("2026-11-06T12:00:00.000Z");

const platformAssignments = [{
  scopeType: "GLOBAL",
  scopeId: "GLOBAL",
  expiresAt: null,
  role: { permissions: [{ permission: { key: "platform:manage" } }, { permission: { key: "users:manage" } }] }
}];

describe("platform administrator permission enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assignmentsMock.mockResolvedValue(platformAssignments);
    stepUpMock.mockResolvedValue({});
  });

  it("requires step-up even when a platform administrator checks an ordinary permission", async () => {
    await expect(userHasPermission("admin-1", { permissionKey: "users:manage", now })).resolves.toBe(true);
    expect(stepUpMock).toHaveBeenCalledWith("admin-1", now);
  });

  it("requires step-up for any-of permission checks", async () => {
    await expect(userHasAnyPermission("admin-1", [{ permissionKey: "support:manage" }], now)).resolves.toBe(true);
    expect(stepUpMock).toHaveBeenCalledWith("admin-1", now);
  });

  it("requires step-up for scoped permission checks too", async () => {
    await expect(userHasScopedPermission("admin-1", {
      permissionKey: "catalog:manage",
      scope: { type: "STORE", id: "store-1" },
      now
    })).resolves.toBe(false);
    expect(stepUpMock).toHaveBeenCalledWith("admin-1", now);
  });

  it("does not force MFA on non-platform users", async () => {
    assignmentsMock.mockResolvedValue([{
      scopeType: "STORE",
      scopeId: "store-1",
      expiresAt: null,
      role: { permissions: [{ permission: { key: "catalog:manage" } }] }
    }]);
    await expect(userHasPermission("seller-1", { permissionKey: "catalog:manage", now })).resolves.toBe(true);
    expect(stepUpMock).not.toHaveBeenCalled();
  });
});
