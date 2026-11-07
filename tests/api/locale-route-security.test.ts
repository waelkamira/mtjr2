import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validate }));

import { POST } from "@/app/api/locale/route";

describe("locale preference mutation boundary", () => {
  beforeEach(() => mocks.validate.mockReturnValue(null));

  it("validates same-origin JSON before changing the locale cookie", async () => {
    const request = new NextRequest("https://mtjr.example/api/locale", {
      method: "POST",
      headers: { origin: "https://mtjr.example", "content-type": "application/json" },
      body: JSON.stringify({ locale: "ar" })
    });
    const response = await POST(request);
    expect(mocks.validate).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("locale");
  });

  it("returns the origin guard response before parsing or mutating", async () => {
    mocks.validate.mockReturnValue(Response.json({ error: "Request origin could not be verified." }, { status: 403 }));
    const request = new NextRequest("https://mtjr.example/api/locale", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ locale: "ar" })
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "Request origin could not be verified." });
  });
});
