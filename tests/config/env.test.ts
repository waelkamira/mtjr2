import { describe, expect, it } from "vitest";
import { isPublicRegistrationEnabled, parseEnvironment } from "../../src/lib/env";

const validEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mtjr2_test?schema=public",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  AUTH_SECRET: "a-test-only-secret-with-at-least-32-characters",
  NODE_ENV: "test"
};

describe("parseEnvironment", () => {
  it("accepts a valid PostgreSQL and application configuration", () => {
    expect(parseEnvironment(validEnvironment)).toMatchObject(validEnvironment);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, DATABASE_URL: "https://example.com" })
    ).toThrow(/DATABASE_URL.*PostgreSQL/);
  });

  it("rejects a short authentication secret without exposing its value", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, AUTH_SECRET: "short-secret" })
    ).toThrow(/AUTH_SECRET/);
  });

  it("rejects an invalid public application URL", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, NEXT_PUBLIC_APP_URL: "not-a-url" })
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("enables registration by default in development and test only", () => {
    expect(parseEnvironment(validEnvironment).PUBLIC_REGISTRATION_ENABLED).toBe("true");
    expect(isPublicRegistrationEnabled(parseEnvironment(validEnvironment))).toBe(true);
    expect(isPublicRegistrationEnabled(parseEnvironment({ ...validEnvironment, NODE_ENV: "development" }))).toBe(true);
    expect(isPublicRegistrationEnabled(parseEnvironment({ ...validEnvironment, NODE_ENV: "production" }))).toBe(false);
    expect(isPublicRegistrationEnabled(parseEnvironment({ ...validEnvironment, NODE_ENV: "production", PUBLIC_REGISTRATION_ENABLED: "true" }))).toBe(false);
  });

  it("allows registration to be explicitly disabled outside production", () => {
    expect(isPublicRegistrationEnabled(parseEnvironment({ ...validEnvironment, PUBLIC_REGISTRATION_ENABLED: "false" }))).toBe(false);
  });

  it("accepts blank optional Google OAuth credentials in local env files", () => {
    expect(parseEnvironment({ ...validEnvironment, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" })).toMatchObject(validEnvironment);
  });

  it("rejects an invalid public registration flag", () => {
    expect(() => parseEnvironment({ ...validEnvironment, PUBLIC_REGISTRATION_ENABLED: "yes" })).toThrow(/PUBLIC_REGISTRATION_ENABLED/);
  });
});
