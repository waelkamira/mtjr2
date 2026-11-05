import { describe, expect, it } from "vitest";
import { safeAuthReturnPath } from "@/lib/auth-return";

describe("authentication return destinations", () => {
  const origin = "https://market.example";

  it("preserves a local path, query and fragment", () => {
    expect(safeAuthReturnPath("/products?category=tea#details", origin)).toBe("/products?category=tea#details");
    expect(safeAuthReturnPath("/", origin)).toBe("/");
  });

  it.each(["https://evil.example/path", "//evil.example/path", "/\\evil.example", "/login?returnTo=/products", "/register/", "/verify-email", "/api/auth/logout", "/bad\npath"])(
    "rejects unsafe or looping destinations: %s", (candidate) => {
      expect(safeAuthReturnPath(candidate, origin)).toBeNull();
    }
  );
});
