import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  groqChat: vi.fn(),
  listMySupportTickets: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/catalog/discovery", () => ({
  getDiscoverableProduct: vi.fn(),
  listDiscoverableProducts: vi.fn()
}));
vi.mock("@/server/orders/orders", () => ({ listCustomerOrders: vi.fn() }));
vi.mock("@/server/returns/returns", () => ({ getMyReturnCenter: vi.fn() }));
vi.mock("@/server/support/tickets", () => ({ listMySupportTickets: mocks.listMySupportTickets }));
vi.mock("@/server/ai/groq-client", () => ({ groqChat: mocks.groqChat }));

import { answerCustomer } from "@/server/ai/assistant";

describe("Matjar AI support ticket tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listMySupportTickets.mockResolvedValue([{
      id: "ticket-1",
      ticketNumber: "SUP-20261108-A1B2C3D4",
      subject: "Order delivery question",
      status: "OPEN",
      priority: "NORMAL",
      updatedAt: "2026-11-08T10:00:00.000Z",
      messageCount: 3
    }]);
    mocks.groqChat
      .mockResolvedValueOnce({
        content: null,
        tool_calls: [{
          id: "support-call",
          type: "function",
          function: { name: "get_my_support_tickets", arguments: "{}" }
        }]
      })
      .mockResolvedValueOnce({ content: "لديك تذكرة دعم مفتوحة. يمكنك فتح مركز الدعم لمتابعتها." });
  });

  it("returns only the current customer's ticket summaries to the UI, never ticket messages to Groq", async () => {
    const result = await answerCustomer({ message: "اعرض تذاكر الدعم الخاصة بي", locale: "ar" });

    expect(mocks.listMySupportTickets).toHaveBeenCalledOnce();
    expect(result.supportTickets).toEqual([{
      id: "ticket-1",
      ticketNumber: "SUP-20261108-A1B2C3D4",
      subject: "Order delivery question",
      status: "OPEN",
      priority: "NORMAL",
      updatedAt: "2026-11-08T10:00:00.000Z",
      messageCount: 3
    }]);

    const toolMessage = mocks.groqChat.mock.calls[1][0].find((message: { role: string }) => message.role === "tool");
    expect(JSON.parse(toolMessage.content)).toEqual({
      message: "The application will securely display the customer's own support-ticket summaries in Matjar. Do not request or repeat ticket details."
    });
    expect(toolMessage.content).not.toContain("Order delivery question");
    expect(toolMessage.content).not.toContain("SUP-20261108-A1B2C3D4");
  });
});
