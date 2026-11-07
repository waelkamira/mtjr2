import { z } from "zod";
import { AuthenticationRequiredError, requireCurrentSession } from "@/server/identity/current-session";
import { userHasPermission, userHasScopedPermission } from "@/server/identity/permission-repository";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function jsonError(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status });
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

async function uploadToImgur(file: File) {
  const clientId = process.env.IMGUR_CLIENT_ID?.trim();
  if (!clientId) throw new Error("Imgur is not configured.");
  const form = new FormData();
  form.append("image", file, file.name);
  const response = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${clientId}` },
    body: form,
    signal: AbortSignal.timeout(25_000)
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: { link?: string }; dataError?: string; error?: string } | null;
  const url = payload?.data?.link;
  if (!response.ok || !url || !url.startsWith("https://")) {
    throw new Error("Imgur upload failed.");
  }
  return { url, provider: "imgur" };
}

async function uploadToImageKit(file: File) {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("ImageKit is not configured.");
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("fileName", file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "product-image");
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(privateKey + ":").toString("base64")}` },
    body: form,
    signal: AbortSignal.timeout(25_000)
  });
  const payload = await response.json().catch(() => null) as { url?: string } | null;
  if (!response.ok || !payload?.url || !payload.url.startsWith("https://")) {
    throw new Error("ImageKit upload failed.");
  }
  return { url: payload.url, provider: "imagekit" };
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
  const file = form.get("file");
  if (!storeId.success || !(file instanceof File)) return jsonError("A store and image file are required.", 400);
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Unsupported image format. Use JPG, PNG, WebP, GIF or AVIF.", 415);
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return jsonError("Image size must be between 1 byte and 10 MB.", 413);

  try {
    if (!(await canManageStore(actor.userId, storeId.data))) return jsonError("You do not have access to this store.", 403);
    const providers = [
      { name: "Imgur", upload: () => uploadToImgur(file) },
      { name: "ImageKit", upload: () => uploadToImageKit(file) }
    ];
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        const result = await provider.upload();
        return Response.json({ success: true, data: result });
      } catch {
        failures.push(provider.name);
      }
    }
    const configured = Boolean(process.env.IMGUR_CLIENT_ID || process.env.IMAGEKIT_PRIVATE_KEY);
    return jsonError(configured
      ? "Image upload failed with all configured providers. Check provider credentials and limits."
      : "Image upload is not configured. Add IMGUR_CLIENT_ID or IMAGEKIT_PRIVATE_KEY to the server environment.", configured ? 502 : 503);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return jsonError("Authentication required.", 401);
    return jsonError(error instanceof Error ? error.message : "Image upload failed.", 400);
  }
}
