import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ validate: vi.fn(), review: vi.fn() }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validate }));
vi.mock("@/server/returns/returns", () => ({ reviewReturnRequest: mocks.review }));

import { PATCH } from "@/app/api/admin/returns/[returnId]/route";

describe("admin return review mutation boundary", () => {
  beforeEach(() => {
    mocks.validate.mockReturnValue(null);
    mocks.review.mockResolvedValue({ id: "return-1", status: "APPROVED" });
  });

  it("rejects a cross-origin request before invoking the review service", async () => {
    mocks.validate.mockReturnValue(Response.json({ error: "Request origin could not be verified." }, { status: 403 }));
    const request = new Request("https://mtjr.example/api/admin/returns/return-1", {
      method: "PATCH", headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ status: "APPROVED" })
    });
    const response = await PATCH(request, { params: Promise.resolve({ returnId: "return-1" }) });
    expect(response.status).toBe(403);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("passes same-origin mutations to the permission-guarded service", async () => {
    const request = new Request("https://mtjr.example/api/admin/returns/return-1", {
      method: "PATCH", headers: { "content-type": "application/json", origin: "https://mtjr.example" },
      body: JSON.stringify({ status: "APPROVED" })
    });
    const response = await PATCH(request, { params: Promise.resolve({ returnId: "return-1" }) });
    expect(mocks.validate).toHaveBeenCalledWith(request);
    expect(mocks.review).toHaveBeenCalledWith("return-1", { status: "APPROVED" });
    expect(response.status).toBe(200);
  });
});
