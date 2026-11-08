import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deleteProductImage } from "@/server/media/product-image-deletion";

describe("product image provider deletion", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("deletes Imgur assets using the account OAuth token", async () => {
    vi.stubEnv("IMGUR_ACCESS_TOKEN", "imgur-owner-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteProductImage("imgur:delete-hash-123")).resolves.toBe("deleted");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.imgur.com/3/image/delete-hash-123",
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer imgur-owner-token" }
      })
    );
  });

  it("deletes ImageKit assets using the private API key", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "imagekit-private-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteProductImage("imagekit:file_123")).resolves.toBe("deleted");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.imagekit.io/v1/files/file_123",
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: `Basic ${Buffer.from("imagekit-private-key:").toString("base64")}` }
      })
    );
  });

  it("deletes Cloudinary assets with a server-generated signature", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "api-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "api-secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "ok" }), {
      status: 200, headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteProductImage("cloudinary:matjar/products/photo_1")).resolves.toBe("deleted");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudinary.com/v1_1/demo-cloud/image/destroy",
      expect.objectContaining({ method: "POST" })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = new URLSearchParams(request.body as string);
    expect(body.get("public_id")).toBe("matjar/products/photo_1");
    expect(body.get("api_key")).toBe("api-key");
    expect(body.get("signature")).toMatch(/^[a-f0-9]{40}$/);
  });

  it("does not call providers when deletion credentials are absent", async () => {
    vi.stubEnv("IMGUR_ACCESS_TOKEN", "");
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteProductImage("imgur:delete-hash-123")).resolves.toBe("unsupported");
    await expect(deleteProductImage("imagekit:file_123")).resolves.toBe("unsupported");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed storage keys without making network requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteProductImage("cloudinary:../../secret")).rejects.toThrow(/Invalid Cloudinary/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
