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

import {
  PermissionDeniedError,
  requirePermission
} from "../../src/server/identity/permission-guard";

const now = new Date("2026-11-03T12:00:00.000Z");
const session = {
  id: "session-1",
  userId: "trusted-user-id",
  expiresAt: new Date(now.getTime() + 60_000),
  user: {
    id: "trusted-user-id",
    email: "buyer@example.com",
    displayName: "Buyer",
    status: "ACTIVE",
    emailVerifiedAt: now
  }
};

describe("server permission guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads permissions only for the user from the verified session", async () => {
    requireSessionMock.mockResolvedValue(session);
    permissionMock.mockResolvedValue(true);
    const request = {
      permissionKey: "catalog.product.update",
      scope: { type: "STORE", id: "store-1" }
    };

    await expect(requirePermission(request, now)).resolves.toEqual(session);
    expect(requireSessionMock).toHaveBeenCalledWith(now);
    expect(permissionMock).toHaveBeenCalledWith("trusted-user-id", {
      ...request,
      now
    });
  });

  it("fails closed when the permission is absent", async () => {
    requireSessionMock.mockResolvedValue(session);
    permissionMock.mockResolvedValue(false);

    await expect(
      requirePermission({ permissionKey: "catalog.product.delete" }, now)
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("does not query permissions when authentication fails", async () => {
    requireSessionMock.mockRejectedValue(new Error("Authentication required"));

    await expect(
      requirePermission({ permissionKey: "catalog.product.update" }, now)
    ).rejects.toThrow("Authentication required");
    expect(permissionMock).not.toHaveBeenCalled();
  });

  it("does not allow a client-provided user ID to select the authorization subject", async () => {
    requireSessionMock.mockResolvedValue(session);
    permissionMock.mockResolvedValue(true);

    await requirePermission({
      permissionKey: "catalog.product.update",
      userId: "attacker-selected-user"
    } as never, now);

    expect(permissionMock).toHaveBeenCalledWith(
      "trusted-user-id",
      expect.objectContaining({ permissionKey: "catalog.product.update" })
    );
  });
});
