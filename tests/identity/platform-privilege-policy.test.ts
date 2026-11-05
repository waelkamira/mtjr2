import { describe, expect, it } from "vitest";
import { isIndependentPrivilegeReviewer } from "../../src/server/identity/platform-privilege-policy";

describe("independent Super Admin privilege review", () => {
  it("allows a third-party reviewer", () => expect(isIndependentPrivilegeReviewer("requester", "target", "reviewer")).toBe(true));
  it("rejects requester self-review", () => expect(isIndependentPrivilegeReviewer("requester", "target", "requester")).toBe(false));
  it("rejects target self-approval", () => expect(isIndependentPrivilegeReviewer("requester", "target", "target")).toBe(false));
});
