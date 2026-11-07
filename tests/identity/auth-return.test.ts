import { afterEach, describe, expect, it, vi } from "vitest";
import { REGISTRATION_NOTICE_KEY, rememberRegistrationNotice, safeAuthReturnPath } from "@/lib/auth-return";

describe("authentication return destinations", () => {
  const origin = "https://market.example";

  afterEach(() => vi.unstubAllGlobals());

  it("preserves a local path, query and fragment", () => {
    expect(safeAuthReturnPath("/products?category=tea#details", origin)).toBe("/products?category=tea#details");
    expect(safeAuthReturnPath("/", origin)).toBe("/");
  });

  it.each(["https://evil.example/path", "//evil.example/path", "/\\evil.example", "/login?returnTo=/products", "/register/", "/verify-email", "/api/auth/logout", "/bad\npath"])(
    "rejects unsafe or looping destinations: %s", (candidate) => {
      expect(safeAuthReturnPath(candidate, origin)).toBeNull();
    }
  );

  it("persists registration completion for the post-redirect notice", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: { setItem: (key: string, value: string) => stored.set(key, value) }
    });

    rememberRegistrationNotice("created");

    expect(stored.get(REGISTRATION_NOTICE_KEY)).toBe("created");
  });
});
