import { describe, expect, it } from "vitest";
import { getRequiredRoleScopeType, isProtectedPlatformRole } from "../../src/server/identity/role-assignment-policy";

describe("isProtectedPlatformRole", () => {
  it("protects the canonical SUPER_ADMIN role", () => {
    expect(isProtectedPlatformRole("SUPER_ADMIN", ["platform:manage"])).toBe(true);
  });

  describe("getRequiredRoleScopeType", () => {
    it("requires STORE scope for store manager assignments", () => {
      expect(getRequiredRoleScopeType("STORE_MANAGER")).toBe("STORE");
    });

    it("keeps ordinary global role assignments unscoped", () => {
      expect(getRequiredRoleScopeType("CUSTOMER")).toBeNull();
      expect(getRequiredRoleScopeType("ADMIN")).toBeNull();
    });
  });

  it("protects any alternate role carrying platform:manage", () => {
    expect(isProtectedPlatformRole("PLATFORM_OPERATOR", ["users:read", "platform:manage"])).toBe(true);
  });

  it("allows ordinary delegated roles without platform-wide management", () => {
    expect(isProtectedPlatformRole("ADMIN", ["users:read", "orders:read"])).toBe(false);
  });
});
