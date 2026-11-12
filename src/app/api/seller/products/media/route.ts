import { z } from "zod";
import { AuthenticationRequiredError, requireCurrentSession } from "@/server/identity/current-session";
import { consumeAuthenticatedActionAttempt } from "@/server/identity/login-throttle";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import {
  validateIdentityImageUploadRequest,
  validateIdentityMutationOrigin,
  validateIdentityMutationRequest
} from "@/server/identity/request-security";
import { prisma } from "@/lib/db/prisma";
import { getNextImgurClientId } from "@/server/media/imgur-client-manager";
import { deleteProductImage } from "@/server/media/product-image-deletion";
import {
  createTemporaryProductImageDeleteToken,
  verifyTemporaryProductImageDeleteToken
} from "@/server/media/temporary-product-image-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function canManageStore(userId: string, storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, status: true, seller: { select: { status: true, ownerId: true } } }
  });
  if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") return false;
  if (store.seller.ownerId === userId) return true;
  const [scopedManager, platformAdmin] = await Promise.all([
    userHasScopedPermission(userId, { permissionKey: "catalog:manage", scope: { type: "STORE", id: store.id } }),
    userHasPermission(userId, { permissionKey: "users:manage" })
  ]);
  return scopedManager || platformAdmin;
}

async function hasValidImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (file.type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (file.type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (file.type === "image/gif") return starts(0x47, 0x49, 0x46, 0x38);
  if (file.type === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (file.type === "image/avif") return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 && ((bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66) || (bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x73));
  return false;
}

function withTemporaryDeleteToken<T extends { storageKey?: string }>(result: T, storeId: string) {
  return {
    ...result,
    ...(result.storageKey
      ? { deleteToken: createTemporaryProductImageDeleteToken(storeId, result.storageKey) }
      : {})
  };
}

async function persistStoreMediaAsset<T extends { url: string; storageKey?: string; mimeType?: string; width?: number; height?: number }>(storeId: string, result: T) {
  try {
    const asset = await prisma.storeMediaAsset.create({
      data: {
        storeId,
        url: result.url,
        storageKey: result.storageKey ?? null,
        mimeType: result.mimeType ?? null,
        width: result.width ?? null,
        height: result.height ?? null
      },
      select: { id: true }
    });
    return { ...withTemporaryDeleteToken(result, storeId), assetId: asset.id };
  } catch (error) {
    if (result.storageKey) await deleteProductImage(result.storageKey).catch(() => undefined);
    throw error;
  }
}

async function uploadToImgur(file: File) {
  const clientId = getNextImgurClientId();
  const response = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${clientId}`, "Content-Type": file.type },
    body: file,
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => null) as { data?: { link?: string; deletehash?: string; width?: number; height?: number }; success?: boolean; } | null;
  const url = payload?.data?.link;
  if (!response.ok || !url || !url.startsWith("https://")) {
    throw new Error(`Imgur rejected the upload (HTTP ${response.status}).`);
  }
  return { url, provider: "imgur" as const, storageKey: payload?.data?.deletehash ? `imgur:${clientId}:${payload.data.deletehash}` : undefined, mimeType: file.type, width: payload?.data?.width, height: payload?.data?.height };
}

async function uploadToImageKit(file: File) {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("ImageKit is not configured.");
  const form = new FormData();
  form.append("file", file, file.name || "product-image");
  form.append("fileName", (file.name || "product-image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120));
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(privateKey + ":").toString("base64")}` },
    body: form,
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => null) as { url?: string; fileId?: string; width?: number; height?: number } | null;
  if (!response.ok || !payload?.url || !payload.url.startsWith("https://")) {
    throw new Error(`ImageKit rejected the upload (HTTP ${response.status}).`);
  }
  return { url: payload.url, provider: "imagekit" as const, storageKey: payload.fileId ? `imagekit:${payload.fileId}` : undefined, mimeType: file.type, width: payload.width, height: payload.height };
}

async function uploadToCloudinary(file: File) {
  // The unsigned preset is public by design; never send the legacy API secret to the browser or this endpoint.
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)?.trim();
  const uploadPreset = (process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_NAME)?.trim();
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary unsigned upload is not configured.");
  const form = new FormData();
  form.append("file", file, file.name || "product-image");
  form.append("upload_preset", uploadPreset);
  form.append("folder", "matjar/products");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => null) as { secure_url?: string; public_id?: string; width?: number; height?: number } | null;
  if (!response.ok || !payload?.secure_url?.startsWith("https://")) {
    throw new Error(`Cloudinary rejected the upload (HTTP ${response.status}). Check that the configured preset allows unsigned uploads.`);
  }
  return { url: payload.secure_url, provider: "cloudinary" as const, storageKey: payload.public_id ? `cloudinary:${payload.public_id}` : undefined, mimeType: file.type, width: payload.width, height: payload.height };
}

export async function POST(request: Request): Promise<Response> {
  // Reject cross-origin requests before authentication, but defer content-type
  // details until after authentication so anonymous probes receive 401/403.
  const originRejected = validateIdentityMutationOrigin(request);
  if (originRejected) return originRejected;

  let actor: Awaited<ReturnType<typeof requireCurrentSession>>;
  try {
    actor = await requireCurrentSession();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return jsonError("Authentication required.", 401);
    return jsonError("Unable to verify the current session.", 401);
  }

  try {
    if (await consumeAuthenticatedActionAttempt(actor.userId, "seller-product-image-upload", 20)) {
      return Response.json({ success: false, error: "Too many image uploads. Please try again later." }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "900" }
      });
    }
  } catch {
    return jsonError("Unable to verify upload rate limits.", 503);
  }

  const contentTypeRejected = validateIdentityImageUploadRequest(request);
  if (contentTypeRejected) return contentTypeRejected;

  // Reject obviously oversized requests before formData() buffers/parses the body.
  // The hosting ingress must also enforce a hard body limit for chunked requests.
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_FILE_SIZE + 256 * 1024) {
      return jsonError("Image upload request exceeds the 10 MB limit.", 413);
    }
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return jsonError("A multipart form upload is required.", 400); }

  const storeId = z.string().trim().min(1).safeParse(form.get("storeId"));
  const file = form.get("file") ?? form.get("image");
  if (!storeId.success || !(file instanceof File)) return jsonError("A store and image file are required.", 400);
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Unsupported image format. Use JPG, PNG, WebP, GIF or AVIF.", 415);
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return jsonError("Image size must be between 1 byte and 10 MB.", 413);
  if (!(await hasValidImageSignature(file))) return jsonError("The uploaded file content does not match its image type.", 415);

  try {
    if (!(await canManageStore(actor.userId, storeId.data))) return jsonError("You do not have access to this store.", 403);
  } catch {
    return jsonError("Unable to verify store access.", 403);
  }

  const errors: string[] = [];
  const imgurConfigured = Boolean(process.env.IMGUR_CLIENT_IDS?.trim() || process.env.IMGUR_CLIENT_ID?.trim());
  const imageKitConfigured = Boolean(process.env.IMAGEKIT_PRIVATE_KEY?.trim());
  const cloudinaryConfigured = Boolean((process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)?.trim() && (process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_NAME)?.trim());

  if (imgurConfigured) {
    try {
      const result = await uploadToImgur(file);
      return Response.json({ success: true, data: await persistStoreMediaAsset(storeId.data, result) }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Imgur upload failed.");
    }
  } else {
    errors.push("Imgur is not configured.");
  }

  if (imageKitConfigured) {
    try {
      const result = await uploadToImageKit(file);
      return Response.json({ success: true, data: await persistStoreMediaAsset(storeId.data, result) }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "ImageKit upload failed.");
    }
  } else {
    errors.push("ImageKit is not configured.");
  }

  if (cloudinaryConfigured) {
    try {
      const result = await uploadToCloudinary(file);
      return Response.json({ success: true, data: await persistStoreMediaAsset(storeId.data, result) }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Cloudinary upload failed.");
    }
  } else {
    errors.push("Cloudinary unsigned upload is not configured.");
  }

  const configured = imgurConfigured || imageKitConfigured || cloudinaryConfigured;
  return jsonError(
    configured
      ? "Image upload providers are unavailable: " + errors.join(" ")
      : "Image upload is not configured. Set IMGUR_CLIENT_IDS, IMAGEKIT_PRIVATE_KEY, or CLOUDINARY_CLOUD_NAME with CLOUDINARY_UPLOAD_PRESET in the server environment.",
    configured ? 502 : 503
  );
}


/** Delete a provider upload that has not yet been attached to a ProductMedia row. */
export async function DELETE(request: Request): Promise<Response> {
  const originRejected = validateIdentityMutationOrigin(request);
  if (originRejected) return originRejected;

  let actor: Awaited<ReturnType<typeof requireCurrentSession>>;
  try {
    actor = await requireCurrentSession();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return jsonError("Authentication required.", 401);
    return jsonError("Unable to verify the current session.", 401);
  }

  try {
    if (await consumeAuthenticatedActionAttempt(actor.userId, "seller-product-image-delete", 30)) {
      return Response.json({ success: false, error: "Too many image deletion attempts. Please try again later." }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "900" }
      });
    }
  } catch {
    return jsonError("Unable to verify image deletion rate limits.", 503);
  }

  const contentTypeRejected = validateIdentityMutationRequest(request);
  if (contentTypeRejected) return contentTypeRejected;

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 16 * 1024)) {
    return jsonError("Image deletion request is too large.", 413);
  }

  const parsed = z.object({
    storeId: z.string().trim().min(1).max(128),
    deleteToken: z.string().trim().min(20).max(2048)
  }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("A valid store and temporary image delete token are required.", 400);

  const storageKey = verifyTemporaryProductImageDeleteToken(parsed.data.deleteToken, parsed.data.storeId);
  if (!storageKey) return jsonError("The temporary image delete token is invalid or expired.", 403);

  let allowed = false;
  try {
    allowed = await canManageStore(actor.userId, parsed.data.storeId);
  } catch {
    return jsonError("Unable to verify store access.", 500);
  }
  if (!allowed) return jsonError("You do not have access to this store.", 403);

  let attachedStoreAsset: { id: string } | null;
  try {
    attachedStoreAsset = await prisma.store.findFirst({
      where: { OR: [{ logoStorageKey: storageKey }, { bannerStorageKey: storageKey }] },
      select: { id: true }
    });
  } catch {
    return jsonError("Unable to verify whether the image is used by a store.", 500);
  }
  if (attachedStoreAsset) return jsonError("This image is currently used as store branding. Remove it from the store profile before deleting the asset.", 409);

  let attached: { id: string } | null;
  try {
    attached = await prisma.productMedia.findFirst({
      where: { storageKey },
      select: { id: true }
    });
  } catch {
    return jsonError("Unable to verify whether the image is attached to a product.", 500);
  }
  if (attached) return jsonError("This image is already attached to a product and cannot be deleted as a temporary upload.", 409);

  try {
    const result = await deleteProductImage(storageKey);
    if (result === "deleted") {
      await prisma.storeMediaAsset.deleteMany({ where: { storeId: parsed.data.storeId, storageKey } });
    }
    return Response.json({
      success: true,
      deleted: result === "deleted",
      ...(result === "unsupported" ? { warning: "The provider deletion credentials are not configured; the image was removed from this draft only." } : {})
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("The temporary image could not be deleted.", 502);
  }
}
