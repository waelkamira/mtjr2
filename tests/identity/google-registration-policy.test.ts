import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env";
import { canCreateOAuthAccount } from "@/server/identity/oauth-registration-policy";

const baseEnvironment = {
  DATABASE_URL: "postgresql://ci:ci@127.0.0.1:5432/mtjr2_test?schema=public",
  NEXT_PUBLIC_APP_URL: "https://mtjr.example.test",
  AUTH_SECRET: "ci-only-secret-that-is-long-enough-for-validation"
};

function environment(overrides: Record<string, string | undefined> = {}) {
  return parseEnvironment({ ...baseEnvironment, ...overrides });
}

describe("Google account creation policy", () => {
  it("blocks new Google accounts in production even when the public flag is true", () => {
    expect(canCreateOAuthAccount(
      environment({ NODE_ENV: "production", PUBLIC_REGISTRATION_ENABLED: "true" }),
      false
    )).toBe(false);
  });

  it("allows an existing linked Google identity to sign in when registration is disabled", () => {
    expect(canCreateOAuthAccount(
      environment({ NODE_ENV: "production", PUBLIC_REGISTRATION_ENABLED: "false" }),
      true
    )).toBe(true);
  });

  it("allows new Google accounts in development when registration is enabled by default", () => {
    expect(canCreateOAuthAccount(environment({ NODE_ENV: "development" }), false)).toBe(true);
  });
});
