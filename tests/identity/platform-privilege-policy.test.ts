import { describe, expect, it } from "vitest";
import { isIndependentPrivilegeReviewer } from "../../src/server/identity/platform-privilege-policy";

describe("isIndependentPrivilegeReviewer", () => {
  it("rejects self-approval", () => {
    expect(isIndependentPrivilegeReviewer("user_requester", "user_requester")).toBe(false);
  });

  it("allows a different authenticated reviewer", () => {
    expect(isIndependentPrivilegeReviewer("user_requester", "user_reviewer")).toBe(true);
  });
});
