import { describe, expect, it } from "vitest";
import { isProtectedPlatformRole } from "../../src/server/identity/role-assignment-policy";

describe("isProtectedPlatformRole", () => {
  it("protects the canonical SUPER_ADMIN role", () => {
    expect(isProtectedPlatformRole("SUPER_ADMIN", ["platform:manage"])).toBe(true);
  });

  it("protects any alternate role carrying platform:manage", () => {
    expect(isProtectedPlatformRole("PLATFORM_OPERATOR", ["users:read", "platform:manage"])).toBe(true);
  });

  it("allows ordinary delegated roles without platform-wide management", () => {
    expect(isProtectedPlatformRole("ADMIN", ["users:read", "orders:read"])).toBe(false);
  });
});
