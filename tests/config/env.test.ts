import { describe, expect, it } from "vitest";
import { isPublicRegistrationEnabled, parseEnvironment } from "../../src/lib/env";

const validEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mtjr2_test?schema=public",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "a-test-only-secret-with-at-least-32-characters",
  NODE_ENV: "test"
};

describe("parseEnvironment", () => {
  it("accepts valid PostgreSQL and application configuration with safe AI defaults", () => {
    expect(parseEnvironment(validEnvironment)).toMatchObject({
      ...validEnvironment,
      AI_ASSISTANT_ENABLED: "false",
      GROQ_MODEL: "openai/gpt-oss-20b"
    });
  });

  it("supports the existing NEXT_PUBLIC_APP_URL local configuration", () => {
    const { APP_URL, ...legacyEnvironment } = validEnvironment;
    const parsed = parseEnvironment({ ...legacyEnvironment, NEXT_PUBLIC_APP_URL: APP_URL });
    expect(parsed.APP_URL).toBe(APP_URL);
  });

  it("prefers APP_URL when both application URL variables are set", () => {
    const parsed = parseEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_APP_URL: "https://legacy.example.com"
    });
    expect(parsed.APP_URL).toBe(validEnvironment.APP_URL);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() => parseEnvironment({ ...validEnvironment, DATABASE_URL: "https://example.com" })).toThrow(/DATABASE_URL.*PostgreSQL/);
  });

  it("rejects a short authentication secret without exposing its value", () => {
    expect(() => parseEnvironment({ ...validEnvironment, AUTH_SECRET: "short-secret" })).toThrow(/AUTH_SECRET/);
  });

  it("rejects an invalid server application URL", () => {
    expect(() => parseEnvironment({ ...validEnvironment, APP_URL: "not-a-url" })).toThrow(/APP_URL/);
  });

  it("requires at least one valid application URL", () => {
    const missingApplicationUrls = {
      DATABASE_URL: validEnvironment.DATABASE_URL,
      AUTH_SECRET: validEnvironment.AUTH_SECRET,
      NODE_ENV: validEnvironment.NODE_ENV
    };
    expect(() => parseEnvironment(missingApplicationUrls)).toThrow(/APP_URL/);
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

  it("accepts blank optional provider credentials in local env files", () => {
    expect(parseEnvironment({
      ...validEnvironment,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      RESEND_API_KEY: "",
      RESEND_FROM_EMAIL: "",
      GROQ_API_KEY: "",
      TRUSTED_PROXY_IP_HEADER: ""
    })).toMatchObject(validEnvironment);
  });

  it("accepts an optional contact email and rejects an invalid one", () => {
    expect(parseEnvironment({ ...validEnvironment, CONTACT_EMAIL: "help@example.com" }).CONTACT_EMAIL).toBe("help@example.com");
    expect(() => parseEnvironment({ ...validEnvironment, CONTACT_EMAIL: "not-an-email" })).toThrow(/CONTACT_EMAIL/);
  });

  it("keeps the AI assistant disabled by default and accepts a server-only Groq key", () => {
    expect(parseEnvironment(validEnvironment).AI_ASSISTANT_ENABLED).toBe("false");
    expect(parseEnvironment({ ...validEnvironment, GROQ_API_KEY: "test-secret" })).toMatchObject({
      AI_ASSISTANT_ENABLED: "false",
      GROQ_API_KEY: "test-secret"
    });
  });

  it("rejects invalid AI enable flags and never includes secret values in errors", () => {
    expect(() => parseEnvironment({ ...validEnvironment, AI_ASSISTANT_ENABLED: "yes" })).toThrow(/AI_ASSISTANT_ENABLED/);
    expect(() => parseEnvironment({ ...validEnvironment, GROQ_API_KEY: "" })).not.toThrow();
  });

  it("uses the safe default model when the configured model is blank", () => {
    expect(parseEnvironment({ ...validEnvironment, GROQ_MODEL: " " }).GROQ_MODEL).toBe("openai/gpt-oss-20b");
  });
});
