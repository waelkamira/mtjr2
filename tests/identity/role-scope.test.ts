import { describe, expect, it } from "vitest";
import { GLOBAL_SCOPE } from "../../src/server/identity/authorization";
import { normalizeRoleScope } from "../../src/server/identity/role-scope";

describe("normalizeRoleScope", () => {
  it("uses the reserved global pair when scope is omitted", () => {
    expect(normalizeRoleScope()).toEqual(GLOBAL_SCOPE);
  });

  it("normalizes a concrete scope type and trims its identifier", () => {
    expect(normalizeRoleScope({ type: " store ", id: " store-42 " })).toEqual({
      type: "STORE",
      id: "store-42"
    });
  });

  it("rejects an incomplete scoped assignment", () => {
    expect(() => normalizeRoleScope({ type: "STORE", id: " " })).toThrow(
      /require both/
    );
  });

  it("rejects the reserved global scope type", () => {
    expect(() => normalizeRoleScope({ type: "GLOBAL", id: "anything" })).toThrow(
      /reserved/
    );
  });

  it("rejects the reserved global identifier", () => {
    expect(() => normalizeRoleScope({ type: "STORE", id: "GLOBAL" })).toThrow(
      /reserved/
    );
  });
});
