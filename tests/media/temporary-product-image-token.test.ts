import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createTemporaryProductImageDeleteToken, verifyTemporaryProductImageDeleteToken } from "@/server/media/temporary-product-image-token";

describe("temporary product image delete capability", () => {
  it("binds the delete token to the store and provider storage key", () => {
    const token = createTemporaryProductImageDeleteToken("store-1", "imgur:delete-hash-123", 1_000);
    expect(verifyTemporaryProductImageDeleteToken(token, "store-1", 2_000)).toBe("imgur:delete-hash-123");
    expect(verifyTemporaryProductImageDeleteToken(token, "store-2", 2_000)).toBeNull();
  });

  it("rejects expired, modified, and malformed tokens", () => {
    const token = createTemporaryProductImageDeleteToken("store-1", "imagekit:file_123", 1_000);
    expect(verifyTemporaryProductImageDeleteToken(token, "store-1", 86_401_001)).toBeNull();
    expect(verifyTemporaryProductImageDeleteToken(token + "x", "store-1", 2_000)).toBeNull();
    expect(verifyTemporaryProductImageDeleteToken("not-a-token", "store-1", 2_000)).toBeNull();
  });

  it("refuses unsupported or malformed provider storage keys at issuance", () => {
    expect(() => createTemporaryProductImageDeleteToken("store-1", "https://example.test/image.jpg")).toThrow();
    expect(() => createTemporaryProductImageDeleteToken("", "imgur:delete-hash-123")).toThrow();
  });
});
