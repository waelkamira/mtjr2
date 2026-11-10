import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env";

const base = {
  DATABASE_URL: "postgresql://ci:ci@localhost:5432/mtjr2",
  AUTH_SECRET: "a".repeat(48),
  NODE_ENV: "production"
};

describe("deployment URL environment resolution", () => {
  it("derives APP_URL from Vercel's unique preview deployment hostname", () => {
    const parsed = parseEnvironment({ ...base, VERCEL_ENV: "preview", VERCEL_URL: "mtjr2-git-feature-example.vercel.app" });
    expect(parsed.APP_URL).toBe("https://mtjr2-git-feature-example.vercel.app");
  });

  it("still requires an explicit stable URL in production", () => {
    expect(() => parseEnvironment({ ...base, VERCEL_ENV: "production", VERCEL_URL: "mtjr2.vercel.app" }))
      .toThrow(/APP_URL or NEXT_PUBLIC_APP_URL must be configured/);
  });

  it("prefers an explicitly configured APP_URL over Vercel preview defaults", () => {
    const parsed = parseEnvironment({
      ...base,
      APP_URL: "https://shop.example.com",
      VERCEL_ENV: "preview",
      VERCEL_URL: "mtjr2-git-feature-example.vercel.app"
    });
    expect(parsed.APP_URL).toBe("https://shop.example.com");
  });
});
