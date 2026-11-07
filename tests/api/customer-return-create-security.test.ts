import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ validate: vi.fn(), create: vi.fn(), list: vi.fn() }));
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: mocks.validate }));
vi.mock("@/server/returns/returns", () => ({ createMyReturnRequest: mocks.create, getMyReturnCenter: mocks.list }));

import { POST } from "@/app/api/returns/route";

describe("customer return creation request boundary", () => {
  beforeEach(() => {
    mocks.validate.mockReturnValue(null);
    mocks.create.mockResolvedValue({ id: "return-1", returnNumber: "RET-1" });
  });

  it("rejects cross-origin mutation before parsing the body or creating a return", async () => {
    mocks.validate.mockReturnValue(Response.json({ error: "Request origin could not be verified." }, { status: 403 }));
    const request = new Request("https://mtjr.example/api/returns", {
      method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ orderId: "order-1", reasonCode: "DAMAGED", items: [] })
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a return only after the same-origin request check", async () => {
    const body = { orderId: "order-1", reasonCode: "DAMAGED", items: [{ orderItemId: "item-1", quantity: 1 }] };
    const request = new Request("https://mtjr.example/api/returns", {
      method: "POST", headers: { origin: "https://mtjr.example", "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const response = await POST(request);
    expect(mocks.validate).toHaveBeenCalledWith(request);
    expect(mocks.create).toHaveBeenCalledWith(body);
    expect(response.status).toBe(201);
  });
});
