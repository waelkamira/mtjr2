import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ProductImageUploadError,
  uploadProductImage,
  validateProductImage
} from "@/server/storage/product-images";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const imageInput = {
  fileName: "photo.jpg",
  contentType: "image/jpeg",
  bytes: jpeg
};

function imageWithByte(byte: number) {
  return { ...imageInput, bytes: new Uint8Array([0xff, 0xd8, 0xff, byte]) };
}

describe("seller product image uploads", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv("IMGUR_CLIENT_ID", "imgur-test-client");
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "imagekit-test-key");
  });

  it("validates the image signature and sanitizes filenames", () => {
    expect(validateProductImage({ ...imageInput, fileName: "../photo.jpg" }).fileName).toBe(".._photo.jpg");
    expect(() => validateProductImage({ ...imageInput, contentType: "image/png" })).toThrow(/does not match/i);
    expect(() => validateProductImage({ ...imageInput, contentType: "image/svg+xml" })).toThrow(/JPEG, PNG, or WebP/i);
  });

  it("uploads to Imgur first when it succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { link: "https://i.imgur.com/photo.jpg" }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadProductImage(imageWithByte(1))).resolves.toEqual({
      url: "https://i.imgur.com/photo.jpg",
      provider: "imgur"
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Client-ID imgur-test-client" });
  });

  it("uses ImageKit as fallback when Imgur rejects an upload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://ik.imagekit.io/store/photo.jpg" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadProductImage(imageWithByte(2))).resolves.toEqual({
      url: "https://ik.imagekit.io/store/photo.jpg",
      provider: "imagekit"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toMatch(/^Basic /);
  });

  it("returns an explicit setup error when no provider is configured", async () => {
    vi.stubEnv("IMGUR_CLIENT_ID", "");
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");

    const error = await uploadProductImage(imageWithByte(3)).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ProductImageUploadError);
    expect(error).toMatchObject({ status: 503 });
  });

  it("reuses a successful upload for duplicate image bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { link: "https://i.imgur.com/deduplicated.jpg" }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const image = imageWithByte(4);

    const first = await uploadProductImage(image);
    const second = await uploadProductImage({ ...image, fileName: "another-name.jpg" });

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shares an in-flight provider request for simultaneous duplicate images", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const image = imageWithByte(5);

    const first = uploadProductImage(image);
    const second = uploadProductImage(image);
    resolveResponse(new Response(JSON.stringify({
      success: true,
      data: { link: "https://i.imgur.com/shared.jpg" }
    }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { url: "https://i.imgur.com/shared.jpg", provider: "imgur" },
      { url: "https://i.imgur.com/shared.jpg", provider: "imgur" }
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
