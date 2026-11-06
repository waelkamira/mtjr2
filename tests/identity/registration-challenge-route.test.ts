import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  setCookie: vi.fn(),
  resolveTrustedClientIp: vi.fn(),
  validateIdentityMutationRequest: vi.fn(),
  consumeRegistrationIpAttempt: vi.fn(),
  verifyRegistrationChallenge: vi.fn(),
  isPublicRegistrationEnabled: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "development",
    TRUSTED_PROXY_IP_HEADER: undefined,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
    AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters"
  },
  isPublicRegistrationEnabled: mocks.isPublicRegistrationEnabled
}));
vi.mock("@/server/identity/trusted-client-ip", () => ({
  resolveTrustedClientIp: mocks.resolveTrustedClientIp
}));
vi.mock("@/server/identity/request-security", () => ({
  validateIdentityMutationRequest: mocks.validateIdentityMutationRequest
}));
vi.mock("@/server/identity/login-throttle", () => ({
  consumeRegistrationIpAttempt: mocks.consumeRegistrationIpAttempt
}));
vi.mock("@/server/identity/turnstile", () => ({
  verifyRegistrationChallenge: mocks.verifyRegistrationChallenge
}));

import { POST } from "@/app/api/auth/registration-challenge/route";

function request() {
  return new Request("http://localhost:3000/api/auth/registration-challenge", {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ turnstileToken: "turnstile-response" })
  });
}

describe("registration challenge endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ set: mocks.setCookie });
    mocks.resolveTrustedClientIp.mockReturnValue("127.0.0.1");
    mocks.validateIdentityMutationRequest.mockReturnValue(null);
    mocks.consumeRegistrationIpAttempt.mockResolvedValue({ blocked: false });
    mocks.verifyRegistrationChallenge.mockResolvedValue(true);
    mocks.isPublicRegistrationEnabled.mockReturnValue(true);
  });

  it("verifies and stores a short-lived HttpOnly challenge for Google registration", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.verifyRegistrationChallenge).toHaveBeenCalledWith("turnstile-response", "127.0.0.1");
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "mtjr_registration_challenge",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/api/auth",
        maxAge: 300
      })
    );
  });

  it("does not issue a challenge cookie for invalid or rate-limited requests", async () => {
    mocks.verifyRegistrationChallenge.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(400);
    expect(mocks.setCookie).not.toHaveBeenCalled();

    mocks.consumeRegistrationIpAttempt.mockResolvedValue({ blocked: true });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.verifyRegistrationChallenge).toHaveBeenCalledOnce();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
