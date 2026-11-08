import "server-only";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ProductImageInput = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

export type UploadedProductImage = {
  url: string;
  provider: "imgur" | "imagekit";
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
};

export class ProductImageUploadError extends Error {
  constructor(message: string, readonly status: 502 | 503) {
    super(message);
    this.name = "ProductImageUploadError";
  }
}

export class ProductImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductImageValidationError";
  }
}

class ProviderUploadError extends Error {
  constructor(
    readonly provider: "imgur" | "imagekit",
    readonly httpStatus: number | null,
    message: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "ProviderUploadError";
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function safeFileName(value: string): string {
  return value.trim().replace(/[\\/\u0000-\u001f]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 160);
}

export function validateProductImage(input: ProductImageInput): ProductImageInput {
  const fileName = safeFileName(input.fileName);
  if (!fileName || fileName === "." || fileName === "..") {
    throw new ProductImageValidationError("Invalid image filename.");
  }
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ProductImageValidationError("Product images must be between 1 byte and 8 MB.");
  }
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw new ProductImageValidationError("Choose a JPEG, PNG, or WebP image.");
  }

  const bytes = input.bytes;
  const matches = input.contentType === "image/jpeg"
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : input.contentType === "image/png"
      ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
      : bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!matches) throw new ProductImageValidationError("The image content does not match its declared file type.");

  return { ...input, fileName };
}

function safeHttpsUrl(value: unknown, provider: string): string {
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

async function readProviderError(response: Response): Promise<string> {
  const raw = (await response.text()).slice(0, 2000);
  if (!raw) return response.statusText || "Provider rejected the upload.";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const key of ["message", "help", "error", "errors"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value.trim().slice(0, 500);
        if (Array.isArray(value)) return value.map(String).join("; ").slice(0, 500);
      }
    }
  } catch {
    // Do not return arbitrary HTML or proxy error pages to the client.
  }
  return response.statusText || "Provider rejected the upload.";
}

function optionalDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100_000 ? value : undefined;
}

async function uploadToImgur(input: ProductImageInput, clientId: string): Promise<UploadedProductImage> {
  const form = new FormData();
  form.append("image", new Blob([toArrayBuffer(input.bytes)], { type: input.contentType }), input.fileName);
  form.append("type", "file");

  let response: Response;
  try {
    response = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: `Client-ID ${clientId}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw new ProviderUploadError("imgur", null, error instanceof Error ? error.message : "Network failure.");
  }

  if (!response.ok) {
    throw new ProviderUploadError("imgur", response.status, await readProviderError(response), response.headers.get("x-request-id") ?? undefined);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("data" in result) || !result.data || typeof result.data !== "object") {
    throw new ProviderUploadError("imgur", response.status, "Imgur returned an invalid response.");
  }
  const data = result.data as Record<string, unknown>;
  if (typeof data.id !== "string") throw new ProviderUploadError("imgur", response.status, "Imgur omitted the uploaded file ID.");

  return {
    url: safeHttpsUrl(data.link, "Imgur"),
    provider: "imgur",
    storageKey: `imgur:${data.id}`,
    mimeType: input.contentType,
    width: optionalDimension(data.width),
    height: optionalDimension(data.height)
  };
}

async function uploadToImageKit(input: ProductImageInput, privateKey: string): Promise<UploadedProductImage> {
  const form = new FormData();
  form.append("file", new Blob([toArrayBuffer(input.bytes)], { type: input.contentType }), input.fileName);
  form.append("fileName", input.fileName);
  form.append("useUniqueFileName", "true");

  let response: Response;
  try {
    response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw new ProviderUploadError("imagekit", null, error instanceof Error ? error.message : "Network failure.");
  }

  if (!response.ok) {
    throw new ProviderUploadError(
      "imagekit",
      response.status,
      await readProviderError(response),
      response.headers.get("x-ik-requestId") ?? undefined
    );
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object") {
    throw new ProviderUploadError("imagekit", response.status, "ImageKit returned an invalid response.");
  }
  const data = result as Record<string, unknown>;
  if (typeof data.fileId !== "string") {
    throw new ProviderUploadError("imagekit", response.status, "ImageKit omitted the uploaded file ID.");
  }

  return {
    url: safeHttpsUrl(data.url, "ImageKit"),
    provider: "imagekit",
    storageKey: `imagekit:${data.fileId}`,
    mimeType: input.contentType,
    width: optionalDimension(data.width),
    height: optionalDimension(data.height)
  };
}

function providerFailureMessage(error: ProviderUploadError): string {
  if (error.provider === "imagekit" && error.httpStatus === 403) {
    return "ImageKit denied the upload. Check that IMAGEKIT_PRIVATE_KEY is current, has Media Read & Write permission, and the account has available upload/storage quota.";
  }
  if (error.provider === "imagekit" && error.httpStatus === 401) {
    return "ImageKit authentication failed. Replace IMAGEKIT_PRIVATE_KEY with the current private API key.";
  }
  return `${error.provider === "imagekit" ? "ImageKit" : "Imgur"} upload failed (HTTP ${error.httpStatus ?? "network"}).`;
}

export async function uploadProductImage(input: ProductImageInput): Promise<UploadedProductImage> {
  const image = validateProductImage(input);
  const imgurClientId = process.env.IMGUR_CLIENT_ID?.trim();
  const imageKitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();

  if (!imgurClientId && !imageKitPrivateKey) {
    throw new ProductImageUploadError("Product image storage is not configured. Set IMGUR_CLIENT_ID or IMAGEKIT_PRIVATE_KEY on the server.", 503);
  }

  const errors: ProviderUploadError[] = [];
  const providers: Array<() => Promise<UploadedProductImage>> = [];
  if (imgurClientId) providers.push(() => uploadToImgur(image, imgurClientId));
  if (imageKitPrivateKey) providers.push(() => uploadToImageKit(image, imageKitPrivateKey));

  for (const upload of providers) {
    try {
      return await upload();
    } catch (error) {
      const providerError = error instanceof ProviderUploadError
        ? error
        : new ProviderUploadError("imagekit", null, error instanceof Error ? error.message : "Unknown provider failure.");
      errors.push(providerError);
      console.error("Product image provider failed.", {
        provider: providerError.provider,
        status: providerError.httpStatus,
        message: providerError.message,
        requestId: providerError.requestId
      });
    }
  }

  const imageKitForbidden = errors.find((error) => error.provider === "imagekit" && error.httpStatus === 403);
  const imageKitUnauthorized = errors.find((error) => error.provider === "imagekit" && error.httpStatus === 401);
  const onlyImageKitConfigured = !imgurClientId && Boolean(imageKitPrivateKey);
  const status = imageKitForbidden || imageKitUnauthorized || onlyImageKitConfigured ? 503 : 502;
  const detail = imageKitForbidden ?? imageKitUnauthorized ?? errors[errors.length - 1];
  const message = detail ? providerFailureMessage(detail) : "All configured image storage providers failed.";
  throw new ProductImageUploadError(message, status);
}
