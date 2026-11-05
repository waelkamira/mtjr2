import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, permissionMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  permissionMock: vi.fn()
}));

vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  requireCurrentSession: requireSessionMock
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: permissionMock
}));

import { PermissionDeniedError, requirePlatformManagement } from "@/server/identity/permission-guard";

const now = new Date("2026-11-06T12:00:00.000Z");
const session = { id: "session-1", userId: "admin-1" };

describe("platform management permission boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue(session);
    permissionMock.mockResolvedValue(true);
  });

  it("requires platform:manage for the verified session actor", async () => {
    await expect(requirePlatformManagement(now)).resolves.toEqual(session);
    expect(permissionMock).toHaveBeenCalledWith("admin-1", {
      permissionKey: "platform:manage",
      now
    });
  });

  it("denies accounts without platform:manage", async () => {
    permissionMock.mockResolvedValue(false);
    await expect(requirePlatformManagement(now)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
