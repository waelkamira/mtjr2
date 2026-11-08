import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ validate: vi.fn(), requireSession: vi.fn(), verify: vi.fn() }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validate }));
vi.mock("@/server/identity/current-session", () => ({
  requireCurrentSession: mocks.requireSession,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  MfaEnrollmentRequiredError: class MfaEnrollmentRequiredError extends Error {},
  MfaVerificationRequiredError: class MfaVerificationRequiredError extends Error {}
}));
vi.mock("@/server/identity/mfa", () => ({ verifyMfaStepUp: mocks.verify }));

import { POST } from "@/app/api/auth/mfa/step-up/route";

const validRequest = () => new Request("https://mtjr.example/api/auth/mfa/step-up", {
  method: "POST", headers: { origin: "https://mtjr.example", "content-type": "application/json" }, body: JSON.stringify({ code: "123456" })
});

describe("platform MFA step-up API boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockReturnValue(null);
    mocks.requireSession.mockResolvedValue({ id: "session-1", userId: "admin-1" });
    mocks.verify.mockResolvedValue(true);
  });

  it("rejects cross-origin requests before reading identity or verifying a code", async () => {
    mocks.validate.mockReturnValue(Response.json({ error: "Cross-origin" }, { status: 403 }));
    const response = await POST(validRequest());
    expect(response.status).toBe(403);
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("verifies a fresh six-digit TOTP for the current session", async () => {
    const request = validRequest();
    const response = await POST(request);
    expect(mocks.validate).toHaveBeenCalledWith(request);
    expect(mocks.verify).toHaveBeenCalledWith("admin-1", "session-1", "123456");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, expiresInSeconds: 600 });
  });

  it("rejects invalid and replayed codes", async () => {
    mocks.verify.mockResolvedValue(false);
    const response = await POST(validRequest());
    expect(response.status).toBe(400);
  });
});
