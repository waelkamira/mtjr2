import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/safe-return-path";

describe("safeReturnPath", () => {
  const origin = "https://market.example";

  it("uses the supplied local path including query and hash", () => {
    expect(safeReturnPath("/checkout?step=delivery#address", origin)).toBe("/checkout?step=delivery#address");
  });

  it("falls back to the homepage when no previous path exists", () => {
    expect(safeReturnPath(null, origin)).toBe("/");
  });

  it("rejects absolute, protocol-relative, backslash, and malformed paths", () => {
    expect(safeReturnPath("https://evil.example", origin)).toBe("/");
    expect(safeReturnPath("//evil.example/path", origin)).toBe("/");
    expect(safeReturnPath("/\\evil.example", origin)).toBe("/");
    expect(safeReturnPath("/bad\u0000path", origin)).toBe("/");
  });

  it("supports an explicit safe fallback", () => {
    expect(safeReturnPath(null, origin, "/account")).toBe("/account");
  });
});
