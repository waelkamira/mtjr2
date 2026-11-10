import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPaymentProvider: vi.fn(),
  getPaymentProviderAdapter: vi.fn(),
  processVerifiedPaymentEvent: vi.fn(),
  verifyWebhook: vi.fn()
}));

vi.mock("@/server/payments/providers/registry", () => ({ getPaymentProvider: mocks.getPaymentProvider, getPaymentProviderAdapter: mocks.getPaymentProviderAdapter }));
vi.mock("@/server/payments/payments", () => ({ processVerifiedPaymentEvent: mocks.processVerifiedPaymentEvent }));

import { POST } from "@/app/api/webhooks/payments/[provider]/route";

const validEvent = {
  eventId: "evt_123",
  eventType: "succeeded" as const,
  providerReference: "pay_123",
  amountMinor: "1500",
  currencyCode: "EUR",
  occurredAt: new Date("2026-11-04T10:00:00.000Z")
};

describe("payment webhook route retry behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyWebhook.mockResolvedValue(validEvent);
    const provider = {
      key: "test_provider", displayName: "Test provider",
      createIntent: vi.fn(), verifyWebhook: mocks.verifyWebhook
    };
    mocks.getPaymentProvider.mockReturnValue(provider);
    mocks.getPaymentProviderAdapter.mockReturnValue(provider);
    mocks.processVerifiedPaymentEvent.mockResolvedValue({ accepted: true, duplicate: false });
  });

  it("returns 400 when signature verification fails", async () => {
    mocks.verifyWebhook.mockRejectedValue(new Error("invalid signature"));
    const response = await POST(new Request("https://example.test/api/webhooks/payments/test_provider", { method: "POST", body: "{}" }), { params: Promise.resolve({ provider: "test_provider" }) });
    expect(response.status).toBe(400);
    expect(mocks.processVerifiedPaymentEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed normalized events", async () => {
    mocks.verifyWebhook.mockResolvedValue({ ...validEvent, currencyCode: "euro" });
    const response = await POST(new Request("https://example.test/api/webhooks/payments/test_provider", { method: "POST", body: "{}" }), { params: Promise.resolve({ provider: "test_provider" }) });
    expect(response.status).toBe(400);
    expect(mocks.processVerifiedPaymentEvent).not.toHaveBeenCalled();
  });

  it("returns retryable 500 when processing fails unexpectedly", async () => {
    mocks.processVerifiedPaymentEvent.mockRejectedValue(new Error("database connection reset"));
    const response = await POST(new Request("https://example.test/api/webhooks/payments/test_provider", { method: "POST", body: "{}" }), { params: Promise.resolve({ provider: "test_provider" }) });
    expect(response.status).toBe(500);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("returns 409 when an event ID is reused with a different payload", async () => {
    mocks.processVerifiedPaymentEvent.mockRejectedValue(new Error("The provider reused an event ID with a different payload."));
    const response = await POST(new Request("https://example.test/api/webhooks/payments/test_provider", { method: "POST", body: "{}" }), { params: Promise.resolve({ provider: "test_provider" }) });
    expect(response.status).toBe(409);
  });

  it("acknowledges successfully processed verified events", async () => {
    const response = await POST(new Request("https://example.test/api/webhooks/payments/test_provider", { method: "POST", body: "{\"event\":\"payment.succeeded\"}" }), { params: Promise.resolve({ provider: "test_provider" }) });
    expect(response.status).toBe(200);
    expect(mocks.processVerifiedPaymentEvent).toHaveBeenCalledWith(expect.objectContaining({ providerKey: "test_provider", event: validEvent, payloadHash: expect.any(String) }));
  });
});
