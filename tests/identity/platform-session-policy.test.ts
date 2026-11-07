import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn(), getMfaAccessState: vi.fn() }));
vi.mock("@/server/identity/current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {}
}));
vi.mock("@/server/identity/mfa", () => ({ getMfaAccessState: mocks.getMfaAccessState }));

import { AuthenticationRequiredError, MfaEnrollmentRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";
import { requirePlatformSessionStepUp } from "@/server/identity/platform-session-policy";

const now = new Date("2026-11-07T12:00:00.000Z");
const session = {
  id: "session-1", userId: "admin-1",
  stepUpVerifiedAt: new Date(now.getTime() - 60_000),
  stepUpExpiresAt: new Date(now.getTime() + 9 * 60_000),
  user: { emailVerifiedAt: new Date(now.getTime() - 86_400_000) }
};

describe("platform administrator MFA step-up policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
    mocks.getMfaAccessState.mockResolvedValue({ enabled: true, required: true, platformRequired: true, privilegedAccountRequired: true, enrollmentRequired: false });
  });

  it("accepts only the current user with enrolled MFA and a fresh ten-minute step-up", async () => {
    await expect(requirePlatformSessionStepUp("admin-1", now)).resolves.toEqual(session);
    expect(mocks.getCurrentSession).toHaveBeenCalledWith(now);
    expect(mocks.getMfaAccessState).toHaveBeenCalledWith("admin-1", now);
  });

  it("rejects missing sessions and subject mismatches", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(AuthenticationRequiredError);
    mocks.getCurrentSession.mockResolvedValueOnce({ ...session, userId: "other-user" });
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("requires MFA enrollment", async () => {
    mocks.getMfaAccessState.mockResolvedValueOnce({ enabled: false });
    await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);
  });

  it("rejects missing, stale, future, expired, and overlong verification windows", async () => {
    const invalid = [
      { ...session, stepUpVerifiedAt: null },
      { ...session, stepUpExpiresAt: null },
      { ...session, stepUpVerifiedAt: new Date(now.getTime() - 11 * 60_000) },
      { ...session, stepUpVerifiedAt: new Date(now.getTime() + 1_000) },
      { ...session, stepUpExpiresAt: new Date(now.getTime()) },
      { ...session, stepUpExpiresAt: new Date(now.getTime() + 11 * 60_000) }
    ];
    for (const value of invalid) {
      mocks.getCurrentSession.mockResolvedValueOnce(value);
      await expect(requirePlatformSessionStepUp("admin-1", now)).rejects.toBeInstanceOf(StepUpRequiredError);
    }
  });
});
