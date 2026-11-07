import "server-only";

import { createHash } from "node:crypto";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UPLOAD_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_UPLOAD_CACHE_ENTRIES = 256;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ProductImageInput = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

type UploadedProductImage = { url: string; provider: "imgur" | "imagekit" };
type CachedUpload = { result: UploadedProductImage; expiresAt: number };

const successfulUploads = new Map<string, CachedUpload>();
const inFlightUploads = new Map<string, Promise<UploadedProductImage>>();

export class ProductImageUploadError extends Error {
  constructor(message: string, readonly status: 502 | 503) {
    super(message);
    this.name = "ProductImageUploadError";
  }
}

export class ProductImageValidationError extends Error {}

function imageDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function getCachedUpload(digest: string, now: number): UploadedProductImage | null {
  const cached = successfulUploads.get(digest);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    successfulUploads.delete(digest);
    return null;
  }
  successfulUploads.delete(digest);
  successfulUploads.set(digest, cached);
  return cached.result;
}

function cacheSuccessfulUpload(digest: string, result: UploadedProductImage, now: number): void {
  successfulUploads.delete(digest);
  successfulUploads.set(digest, { result, expiresAt: now + UPLOAD_CACHE_TTL_MS });
  while (successfulUploads.size > MAX_UPLOAD_CACHE_ENTRIES) {
    const oldestDigest = successfulUploads.keys().next().value;
    if (oldestDigest === undefined) break;
    successfulUploads.delete(oldestDigest);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function validateProductImage(input: ProductImageInput): ProductImageInput {
  const fileName = input.fileName.trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180);
  if (!fileName || fileName === "." || fileName === "..") throw new ProductImageValidationError("Invalid image filename.");
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ProductImageValidationError("Product images must be between 1 byte and 8 MB.");
  }
  if (!allowedTypes.has(input.contentType)) throw new ProductImageValidationError("Choose a JPEG, PNG, or WebP image.");

  const bytes = input.bytes;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const isWebp = bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    (input.contentType === "image/jpeg" && !isJpeg) ||
    (input.contentType === "image/png" && !isPng) ||
    (input.contentType === "image/webp" && !isWebp)
  ) {
    throw new ProductImageValidationError("The image content does not match its file type.");
  }
  return { ...input, fileName };
}

function providerUrl(value: unknown, provider: string) {
  if (typeof value !== "string") throw new Error(`${provider} returned an invalid image URL.`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${provider} returned an unsafe image URL.`);
  }
  if (provider === "Imgur" && url.hostname !== "i.imgur.com") {
    throw new Error("Imgur returned an unexpected image host.");
  }
  return url.toString();
}

async function uploadToImgur(input: ProductImageInput, clientId: string) {
  const form = new FormData();
  form.append("image", new Blob([toArrayBuffer(input.bytes)], { type: input.contentType }), input.fileName);
  form.append("type", "file");
  const response = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${clientId}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Imgur upload returned HTTP ${response.status}.`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("data" in result) || !result.data || typeof result.data !== "object" || !("link" in result.data)) {
    throw new Error("Imgur returned an invalid upload response.");
  }
  return { url: providerUrl(result.data.link, "Imgur"), provider: "imgur" as const };
}

async function uploadToImageKit(input: ProductImageInput, privateKey: string) {
  const form = new FormData();
  form.append("file", new Blob([toArrayBuffer(input.bytes)], { type: input.contentType }), input.fileName);
  form.append("fileName", input.fileName);
  form.append("useUniqueFileName", "true");
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`ImageKit upload returned HTTP ${response.status}.`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("url" in result)) {
    throw new Error("ImageKit returned an invalid upload response.");
  }
  return { url: providerUrl(result.url, "ImageKit"), provider: "imagekit" as const };
}

async function uploadProductImageWithProviders(image: ProductImageInput): Promise<UploadedProductImage> {
  const imgurClientId = process.env.IMGUR_CLIENT_ID?.trim();
  const imageKitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!imgurClientId && !imageKitPrivateKey) {
    throw new ProductImageUploadError("Configure IMGUR_CLIENT_ID or IMAGEKIT_PRIVATE_KEY to enable image uploads.", 503);
  }

  let imgurError: unknown;
  if (imgurClientId) {
    try {
      return await uploadToImgur(image, imgurClientId);
    } catch (cause) {
      imgurError = cause;
      console.error("Imgur product image upload failed.", cause instanceof Error ? cause.message : "Unknown provider error.");
    }
  }

  if (imageKitPrivateKey) {
    try {
      return await uploadToImageKit(image, imageKitPrivateKey);
    } catch (cause) {
      console.error("ImageKit product image upload failed.", cause instanceof Error ? cause.message : "Unknown provider error.");
      throw new ProductImageUploadError(
        imgurClientId
          ? "Image upload failed on Imgur and ImageKit."
          : "Image upload failed on ImageKit.",
        502
      );
    }
  }

  throw new ProductImageUploadError(
    imgurError instanceof Error ? "Image upload failed on Imgur; ImageKit fallback is not configured." : "Imgur image upload is not configured.",
    imgurClientId ? 502 : 503
  );
}

export async function uploadProductImage(input: ProductImageInput): Promise<UploadedProductImage> {
  const image = validateProductImage(input);
  const digest = imageDigest(image.bytes);
  const now = Date.now();
  const cached = getCachedUpload(digest, now);
  if (cached) return cached;

  const pending = inFlightUploads.get(digest);
  if (pending) return pending;

  const upload = uploadProductImageWithProviders(image)
    .then((result) => {
      cacheSuccessfulUpload(digest, result, Date.now());
      return result;
    })
    .finally(() => inFlightUploads.delete(digest));
  inFlightUploads.set(digest, upload);
  return upload;
}
