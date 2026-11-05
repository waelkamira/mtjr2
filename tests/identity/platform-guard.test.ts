import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, permissionMock, authenticatorMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  permissionMock: vi.fn(),
  authenticatorMock: vi.fn()
}));

vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  requireCurrentSession: requireSessionMock
}));
vi.mock("@/server/identity/permission-repository", () => ({
  userHasPermission: permissionMock
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { userMfaAuthenticator: { findUnique: authenticatorMock } }
}));

import {
  EmailVerificationRequiredError,
  MfaEnrollmentRequiredError,
  PermissionDeniedError,
  StepUpRequiredError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";

const now = new Date("2026-11-06T12:00:00.000Z");
const session = {
  id: "session-1",
  userId: "admin-1",
  expiresAt: new Date(now.getTime() + 60_000),
  stepUpVerifiedAt: new Date(now.getTime() - 60_000),
  stepUpExpiresAt: new Date(now.getTime() + 9 * 60_000),
  user: {
    id: "admin-1",
    email: "admin@example.test",
    displayName: "Platform Admin",
    status: "ACTIVE",
    emailVerifiedAt: new Date(now.getTime() - 86_400_000)
  }
};

describe("platform management security gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue(session);
    permissionMock.mockResolvedValue(true);
    authenticatorMock.mockResolvedValue({ enabledAt: new Date(now.getTime() - 86_400_000) });
  });

  it("requires the platform permission from the verified session", async () => {
    await expect(requirePlatformManagement(now)).resolves.toEqual(session);
    expect(permissionMock).toHaveBeenCalledWith("admin-1", {
      permissionKey: "platform:manage",
      now
    });
  });

  it("rejects users without the platform permission", async () => {
    permissionMock.mockResolvedValue(false);
    await expect(requirePlatformManagement(now)).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(authenticatorMock).not.toHaveBeenCalled();
  });

  it("requires a verified email", async () => {
    requireSessionMock.mockResolvedValue({
      ...session,
      user: { ...session.user, emailVerifiedAt: null }
    });
    await expect(requirePlatformManagement(now)).rejects.toBeInstanceOf(EmailVerificationRequiredError);
  });

  it("requires an enrolled authenticator", async () => {
    authenticatorMock.mockResolvedValue(null);
    await expect(requirePlatformManagement(now)).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);
  });

  it("rejects a missing, stale, future, expired, or overlong step-up window", async () => {
    const invalidSessions = [
      { ...session, stepUpVerifiedAt: null },
      { ...session, stepUpExpiresAt: null },
      { ...session, stepUpVerifiedAt: new Date(now.getTime() - 11 * 60_000) },
      { ...session, stepUpVerifiedAt: new Date(now.getTime() + 1_000) },
      { ...session, stepUpExpiresAt: new Date(now.getTime()) },
      { ...session, stepUpExpiresAt: new Date(now.getTime() + 11 * 60_000) }
    ];
    for (const invalid of invalidSessions) {
      requireSessionMock.mockResolvedValueOnce(invalid);
      await expect(requirePlatformManagement(now)).rejects.toBeInstanceOf(StepUpRequiredError);
    }
  });
});
