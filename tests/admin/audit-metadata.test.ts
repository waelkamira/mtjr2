import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "../../src/server/admin/audit-metadata";

describe("sanitizeAuditMetadata", () => {
  it("redacts credential and payment-secret fields recursively", () => {
    expect(sanitizeAuditMetadata({
      action: "user.updated",
      credentials: "[redacted]",
      payment: { cardNumber: "4111111111111111", cvv: "123" }
    })).toEqual({
      action: "user.updated",
      credentials: "[redacted]",
      payment: { cardNumber: "[redacted]", cvv: "[redacted]" }
    });
  });

  it("preserves safe operational metadata", () => {
    expect(sanitizeAuditMetadata({ targetUserId: "user_1", roleKey: "SUPPORT", changed: true }))
      .toEqual({ targetUserId: "user_1", roleKey: "SUPPORT", changed: true });
  });

  it("bounds nested payloads and long strings", () => {
    expect(sanitizeAuditMetadata({ note: "x".repeat(5000) })).toEqual({ note: `${"x".repeat(4000)}… [truncated]` });
  });
});
