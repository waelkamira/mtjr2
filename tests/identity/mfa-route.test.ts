import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  beginMfaEnrollment: vi.fn(),
  confirmMfaEnrollment: vi.fn(),
  disableMfa: vi.fn(),
  getMfaAccessState: vi.fn(),
  isMfaVerificationFresh: vi.fn(),
  verifyMfaSession: vi.fn(),
  clearLoginThrottle: vi.fn(),
  consumeLoginAttempt: vi.fn(),
  resolveTrustedClientIp: vi.fn(),
  validateIdentityMutationRequest: vi.fn()
}));

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "development", TRUSTED_PROXY_IP_HEADER: undefined }
}));
vi.mock("@/server/identity/current-session", () => ({
  getCurrentSession: mocks.getCurrentSession
}));
vi.mock("@/server/identity/mfa", () => ({
  beginMfaEnrollment: mocks.beginMfaEnrollment,
  confirmMfaEnrollment: mocks.confirmMfaEnrollment,
  disableMfa: mocks.disableMfa,
  getMfaAccessState: mocks.getMfaAccessState,
  isMfaVerificationFresh: mocks.isMfaVerificationFresh,
  verifyMfaSession: mocks.verifyMfaSession
}));
vi.mock("@/server/identity/login-throttle", () => ({
  clearLoginThrottle: mocks.clearLoginThrottle,
  consumeLoginAttempt: mocks.consumeLoginAttempt
}));
vi.mock("@/server/identity/trusted-client-ip", () => ({
  resolveTrustedClientIp: mocks.resolveTrustedClientIp
}));
vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest
}));

import {
  GET,
  POST
} from "../../src/app/api/account/security/mfa/route";

const session = {
  id: "session-1",
  userId: "user-1",
  user: { email: "admin@example.test" }
};

function postRequest(body: unknown) {
  return new Request("http://localhost:3000/api/account/security/mfa", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("MFA account security route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(session);
    mocks.getMfaAccessState.mockResolvedValue({
      enabled: true,
      required: true,
      platformRequired: true,
      enrollmentRequired: false
    });
    mocks.isMfaVerificationFresh.mockReturnValue(false);
    mocks.verifyMfaSession.mockResolvedValue(true);
    mocks.consumeLoginAttempt.mockResolvedValue({ blocked: false });
    mocks.clearLoginThrottle.mockResolvedValue(undefined);
    mocks.resolveTrustedClientIp.mockReturnValue("127.0.0.1");
    mocks.validateIdentityMutationRequest.mockReturnValue(null);
  });

  it("reports MFA status without caching it", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      enabled: true,
      required: true,
      platformRequired: true,
      enrollmentRequired: false,
      verified: false
    });
  });

  it("verifies the current session and clears its throttle after success", async () => {
    const response = await POST(postRequest({ action: "verify", code: "123456" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true });
    expect(mocks.verifyMfaSession).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      "123456"
    );
    expect(mocks.clearLoginThrottle).toHaveBeenCalledWith(
      "admin@example.test",
      "127.0.0.1"
    );
  });

  it("rate-limits invalid MFA attempts before invoking verification", async () => {
    mocks.consumeLoginAttempt.mockResolvedValue({ blocked: true });

    const response = await POST(postRequest({ action: "verify", code: "123456" }));

    expect(response.status).toBe(429);
    expect(mocks.verifyMfaSession).not.toHaveBeenCalled();
  });

  it("rejects an invalid code without clearing the throttle", async () => {
    mocks.verifyMfaSession.mockResolvedValue(false);

    const response = await POST(postRequest({ action: "verify", code: "123456" }));

    expect(response.status).toBe(400);
    expect(mocks.clearLoginThrottle).not.toHaveBeenCalled();
  });
});
