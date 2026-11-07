import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/server/advertising/delivery", () => ({ generateAdInvoices: mocks.generate }));

import { POST } from "@/app/api/cron/advertising-invoices/route";

describe("monthly advertising invoice worker authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "c".repeat(48);
    mocks.generate.mockResolvedValue({ created: 2, stores: 2 });
  });

  it("accepts the configured bearer secret and generates the previous UTC month", async () => {
    const response = await POST(new Request("https://mtjr.example/api/cron/advertising-invoices", {
      method: "POST",
      headers: { authorization: "Bearer " + process.env.CRON_SECRET }
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 2, stores: 2 });
    expect(mocks.generate).toHaveBeenCalledOnce();
    const period = mocks.generate.mock.calls[0][0] as { periodStart: Date; periodEnd: Date; dueAt: Date };
    expect(period.periodStart.getUTCDate()).toBe(1);
    expect(period.periodEnd.getUTCDate()).toBe(1);
    expect(period.periodStart.getTime()).toBeLessThan(period.periodEnd.getTime());
    expect(period.dueAt.getTime()).toBeGreaterThanOrEqual(period.periodEnd.getTime());
  });

  it("rejects a missing or incorrect bearer token without invoking the worker", async () => {
    const missing = await POST(new Request("https://mtjr.example/api/cron/advertising-invoices", { method: "POST" }));
    const incorrect = await POST(new Request("https://mtjr.example/api/cron/advertising-invoices", {
      method: "POST", headers: { authorization: "Bearer wrong-secret" }
    }));
    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("rejects requests when the worker secret is not configured without disclosing configuration state", async () => {
    delete process.env.CRON_SECRET;
    const response = await POST(new Request("https://mtjr.example/api/cron/advertising-invoices", {
      method: "POST", headers: { authorization: "Bearer " + "c".repeat(48) }
    }));
    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
