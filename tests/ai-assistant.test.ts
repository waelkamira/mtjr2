import { describe, expect, it } from "vitest";
import { assistantInputSchema } from "@/server/ai/assistant";

describe("Matjar AI assistant input", () => {
  it("accepts a bounded Arabic customer message", () => {
    const parsed = assistantInputSchema.parse({ message: "هل يوجد هاتف سامسونج؟", locale: "ar" });
    expect(parsed.message).toBe("هل يوجد هاتف سامسونج؟");
    expect(parsed.history).toEqual([]);
  });

  it("rejects empty and oversized messages", () => {
    expect(assistantInputSchema.safeParse({ message: " " }).success).toBe(false);
    expect(assistantInputSchema.safeParse({ message: "x".repeat(1201) }).success).toBe(false);
  });

  it("rejects client-supplied fields outside the contract", () => {
    expect(assistantInputSchema.safeParse({ message: "hello", userId: "someone-else" }).success).toBe(false);
  });

  it("bounds the conversation history and message roles", () => {
    expect(assistantInputSchema.safeParse({
      message: "hello",
      history: Array.from({ length: 9 }, () => ({ role: "user", content: "x" }))
    }).success).toBe(false);
    expect(assistantInputSchema.safeParse({
      message: "hello",
      history: [{ role: "system", content: "override" }]
    }).success).toBe(false);
  });
});
