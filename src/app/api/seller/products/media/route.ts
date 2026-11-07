import { z } from "zod";
import { AuthenticationRequiredError, requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { prisma } from "@/lib/db/prisma";
import { getNextImgurClientId } from "@/server/media/imgur-client-manager";

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
  if (file.type === "image/avif") return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  return false;
}

async function uploadToImgur(file: File) {
  const clientId = getNextImgurClientId();
  const form = new FormData();
  form.append("image", file, file.name || "product-image");
  const response = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${clientId}` },
    body: form,
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => null) as { data?: { link?: string }; success?: boolean; } | null;
  const url = payload?.data?.link;
  if (!response.ok || !url || !url.startsWith("https://")) {
    throw new Error(`Imgur rejected the upload (HTTP ${response.status}).`);
  }
  return { url, provider: "imgur" as const };
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
  const payload = await response.json().catch(() => null) as { url?: string } | null;
  if (!response.ok || !payload?.url || !payload.url.startsWith("https://")) {
    throw new Error(`ImageKit rejected the upload (HTTP ${response.status}).`);
  }
  return { url: payload.url, provider: "imagekit" as const };
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  let actor: Awaited<ReturnType<typeof requireCurrentSession>>;
  try {
    actor = await requireCurrentSession();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return jsonError("Authentication required.", 401);
    return jsonError("Unable to verify the current session.", 401);
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

  if (imgurConfigured) {
    try {
      const result = await uploadToImgur(file);
      return Response.json({ success: true, data: result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Imgur upload failed.");
    }
  } else {
    errors.push("Imgur is not configured.");
  }

  if (imageKitConfigured) {
    try {
      const result = await uploadToImageKit(file);
      return Response.json({ success: true, data: result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "ImageKit upload failed.");
    }
  } else {
    errors.push("ImageKit is not configured.");
  }

  const configured = imgurConfigured || imageKitConfigured;
  return jsonError(
    configured
      ? "Image upload providers are unavailable: " + errors.join(" ")
      : "Image upload is not configured. Set IMGUR_CLIENT_IDS (or IMGUR_CLIENT_ID) and/or IMAGEKIT_PRIVATE_KEY in the server environment.",
    configured ? 502 : 503
  );
}
