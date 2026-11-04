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
  it("keeps public registration disabled unless explicitly enabled", () => {
    expect(parseEnvironment(validEnvironment).PUBLIC_REGISTRATION_ENABLED).toBe("false");
    expect(parseEnvironment({ ...validEnvironment, PUBLIC_REGISTRATION_ENABLED: "true" }).PUBLIC_REGISTRATION_ENABLED).toBe("true");
  });

  it("rejects an invalid public registration flag", () => {
    expect(() => parseEnvironment({ ...validEnvironment, PUBLIC_REGISTRATION_ENABLED: "yes" })).toThrow(/PUBLIC_REGISTRATION_ENABLED/);
  });

});
