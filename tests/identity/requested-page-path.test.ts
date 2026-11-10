import { describe, expect, it } from "vitest";
import { resolveRequestedPagePath } from "@/lib/requested-page-path";

describe("resolveRequestedPagePath", () => {
  const origin = "https://market.example";

  it("preserves the requested protected route and query", () => {
    expect(resolveRequestedPagePath(
      "/account/orders?status=shipped",
      "/account",
      "/account",
      origin
    )).toBe("/account/orders?status=shipped");
  });

  it("rejects paths outside the protected route family", () => {
    expect(resolveRequestedPagePath(
      "/admin/users",
      "/account",
      "/account",
      origin
    )).toBe("/account");
  });

  it("rejects external redirect destinations", () => {
    expect(resolveRequestedPagePath(
      "//outside.example/path",
      "/admin",
      "/admin/dashboard",
      origin
    )).toBe("/admin/dashboard");
  });
});
