import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProductImageUploadError,
  ProductImageValidationError,
  uploadProductImage,
  validateProductImage
} from "@/server/storage/product-images";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]);

describe("product image storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("validates actual image signatures instead of trusting the browser MIME type", () => {
    expect(() => validateProductImage({
      fileName: "../bad.jpg",
      contentType: "image/jpeg",
      bytes: new Uint8Array([1, 2, 3])
    })).toThrow(ProductImageValidationError);
    expect(validateProductImage({
      fileName: "../good.jpg",
      contentType: "image/jpeg",
      bytes: jpeg
    }).fileName).toBe(".._good.jpg");
  });

  it("returns durable provider identifiers and media metadata for ImageKit uploads", async () => {
    vi.stubEnv("IMGUR_CLIENT_ID", "");
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "private_test_key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      fileId: "ik-file-123",
      url: "https://ik.imagekit.io/demo/product.jpg",
      fileType: "image/jpeg",
      width: 1200,
      height: 900
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadProductImage({
      fileName: "product.jpg",
      contentType: "image/jpeg",
      bytes: jpeg
    });

    expect(result).toEqual({
      url: "https://ik.imagekit.io/demo/product.jpg",
      provider: "imagekit",
      storageKey: "imagekit:ik-file-123",
      mimeType: "image/jpeg",
      width: 1200,
      height: 900
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("authorization")).toBe(`Basic ${Buffer.from("private_test_key:").toString("base64")}`);
  });

  it("classifies ImageKit 403 as a provider configuration/permission failure, not a generic gateway failure", async () => {
    vi.stubEnv("IMGUR_CLIENT_ID", "");
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "private_restricted_key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "The key does not have permission to upload."
    }), { status: 403, headers: { "x-ik-requestId": "request-123" } })));

    await expect(uploadProductImage({
      fileName: "product.jpg",
      contentType: "image/jpeg",
      bytes: jpeg
    })).rejects.toMatchObject({
      name: "ProductImageUploadError",
      status: 503,
      message: expect.stringContaining("Media Read & Write")
    });
  });

  it("fails clearly when no image provider is configured", async () => {
    vi.stubEnv("IMGUR_CLIENT_ID", "");
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");
    await expect(uploadProductImage({
      fileName: "product.jpg",
      contentType: "image/jpeg",
      bytes: jpeg
    })).rejects.toMatchObject({
      name: "ProductImageUploadError",
      status: 503
    });
  });
});
