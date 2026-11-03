import { describe, expect, it } from "vitest";
import { hasPermission, type AuthorizationGrant } from "../../src/server/identity/authorization";

const now = new Date("2026-11-03T12:00:00.000Z");

function grant(
  overrides: Partial<AuthorizationGrant> = {}
): AuthorizationGrant {
  return {
    permissionKey: "catalog.product.update",
    scopeType: "GLOBAL",
    scopeId: "GLOBAL",
    expiresAt: null,
    ...overrides
  };
}

describe("hasPermission", () => {
  it("allows a matching global grant", () => {
    expect(
      hasPermission([grant()], {
        permissionKey: "catalog.product.update",
        scope: { type: "STORE", id: "store-1" },
        now
      })
    ).toBe(true);
  });

  it("allows a grant for the exact requested scope", () => {
    expect(
      hasPermission(
        [grant({ scopeType: "STORE", scopeId: "store-1" })],
        {
          permissionKey: "catalog.product.update",
          scope: { type: "STORE", id: "store-1" },
          now
        }
      )
    ).toBe(true);
  });

  it("denies access to a different store", () => {
    expect(
      hasPermission(
        [grant({ scopeType: "STORE", scopeId: "store-1" })],
        {
          permissionKey: "catalog.product.update",
          scope: { type: "STORE", id: "store-2" },
          now
        }
      )
    ).toBe(false);
  });

  it("denies expired grants", () => {
    expect(
      hasPermission(
        [grant({ expiresAt: new Date("2026-11-03T11:59:59.000Z") })],
        { permissionKey: "catalog.product.update", now }
      )
    ).toBe(false);
  });

  it("denies a scoped grant when the request has no scope", () => {
    expect(
      hasPermission(
        [grant({ scopeType: "STORE", scopeId: "store-1" })],
        { permissionKey: "catalog.product.update", now }
      )
    ).toBe(false);
  });

  it("denies a different permission", () => {
    expect(
      hasPermission([grant()], {
        permissionKey: "catalog.product.delete",
        now
      })
    ).toBe(false);
  });
});
