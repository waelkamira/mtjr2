import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ validate: vi.fn(), logoutAll: vi.fn() }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validate }));
vi.mock("@/server/identity/logout", () => ({ logoutAllSessions: mocks.logoutAll }));

import { POST } from "@/app/api/auth/logout-all/route";

describe("sign out all sessions request boundary", () => {
  beforeEach(() => {
    mocks.validate.mockReturnValue(null);
    mocks.logoutAll.mockResolvedValue(2);
  });

  it("rejects cross-origin requests before revoking any session", async () => {
    mocks.validate.mockReturnValue(Response.json({ error: "Request origin could not be verified." }, { status: 403 }));
    const request = new Request("https://mtjr.example/api/auth/logout-all", {
      method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: "{}"
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mocks.logoutAll).not.toHaveBeenCalled();
  });

  it("revokes sessions after the request boundary is accepted", async () => {
    const request = new Request("https://mtjr.example/api/auth/logout-all", {
      method: "POST", headers: { origin: "https://mtjr.example", "content-type": "application/json" }, body: "{}"
    });
    const response = await POST(request);
    expect(mocks.validate).toHaveBeenCalledWith(request);
    expect(mocks.logoutAll).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revokedSessions: 2 });
  });
});
