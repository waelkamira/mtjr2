import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, authenticatorMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  authenticatorMock: vi.fn()
}));

vi.mock("@/server/identity/current-session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error { constructor() { super("Authentication is required."); } },
  getCurrentSession: sessionMock
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { userMfaAuthenticator: { findUnique: authenticatorMock } }
}));

import {
  EmailVerificationRequiredError,
  MfaEnrollmentRequiredError,
  StepUpRequiredError,
  requirePlatformSessionStepUp
} from "@/server/identity/platform-session-policy";

const now = new Date("2026-11-06T12:00:00.000Z");
const validSession = {
  id: "session-1",
  userId: "admin-1",
  stepUpVerifiedAt: new Date(now.getTime() - 60_000),
  stepUpExpiresAt: new Date(now.getTime() + 9 * 60_000),
  user: { emailVerifiedAt: new Date(now.getTime() - 86_400_000) }
};

describe("platform administrator session policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.mockResolvedValue(validSession);
    authenticatorMock.mockResolvedValue({ enabledAt: new Date(now.getTime() - 86_400_000) });
  });

  it("accepts only the matching authenticated user with a verified email, enrolled MFA and fresh step-up", async () => {
    await expect(requirePlatformSessionStepUp("admin-1", now)).resolves.toEqual(validSession);
    expect(sessionMock).toHaveBeenCalledWith(now);
    expect(authenticatorMock).toHaveBeenCalledWith({
      where: { userId: "admin-1" },
      select: { enabledAt: true }
    });
  });

  it("rejects a missing session or a different authorization subject", async () => {
    sessionMock.mockResolvedValueOnce(null);
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toThrow("Authentication is required.");
    sessionMock.mockResolvedValueOnce({ ...validSession, userId: "another-user" });
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toThrow("Authentication is required.");
  });

  it("requires verified email and enrolled MFA", async () => {
    sessionMock.mockResolvedValueOnce({
      ...validSession,
      user: { emailVerifiedAt: null }
    });
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(EmailVerificationRequiredError);

    authenticatorMock.mockResolvedValueOnce(null);
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);
  });

  it("rejects missing, stale, future, expired, or overlong step-up windows", async () => {
    const invalidSessions = [
      { ...validSession, stepUpVerifiedAt: null },
      { ...validSession, stepUpExpiresAt: null },
      { ...validSession, stepUpVerifiedAt: new Date(now.getTime() - 11 * 60_000) },
      { ...validSession, stepUpVerifiedAt: new Date(now.getTime() + 1_000) },
      { ...validSession, stepUpExpiresAt: new Date(now.getTime()) },
      { ...validSession, stepUpExpiresAt: new Date(now.getTime() + 11 * 60_000) }
    ];
    for (const invalid of invalidSessions) {
      sessionMock.mockResolvedValueOnce(invalid);
      await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(StepUpRequiredError);
    }
  });
});
