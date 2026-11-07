import { AuthenticationRequiredError, PermissionDeniedError, requireCurrentSession } from "@/server/identity/current-session";
import { validateIdentityImageUploadRequest } from "@/server/identity/request-security";
import { consumeAuthenticatedActionAttempt } from "@/server/identity/login-throttle";
import { canManageStoreCatalog } from "@/server/catalog/products";
import { prisma } from "@/lib/db/prisma";
import {
  ProductImageUploadError,
  ProductImageValidationError,
  uploadProductImage
} from "@/server/storage/product-images";

export const runtime = "nodejs";

const maxRequestBytes = 8 * 1024 * 1024 + 64 * 1024;

class UploadBodyTooLargeError extends Error {}

async function parseBoundedFormData(request: Request): Promise<FormData> {
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError("The multipart request body is empty.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxRequestBytes) {
        await reader.cancel();
        throw new UploadBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(totalBytes);
  const bodyBytes = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") ?? "");
  return new Request(request.url, { method: "POST", headers, body }).formData();
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityImageUploadRequest(request);
  if (rejected) return rejected;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return Response.json({ error: "Product images must be smaller than 8 MB." }, { status: 413 });
  }

  try {
    const actor = await requireCurrentSession();
    if (await consumeAuthenticatedActionAttempt(actor.userId, "product-image-upload", 20)) {
      return Response.json({ error: "Too many image uploads. Please try again later." }, {
        status: 429, headers: { "Retry-After": "900" }
      });
    }
    let form: FormData;
    try {
      form = await parseBoundedFormData(request);
    } catch (error) {
      if (error instanceof UploadBodyTooLargeError) {
        return Response.json({ error: "Product images must be smaller than 8 MB." }, { status: 413 });
      }
      if (error instanceof TypeError) {
        return Response.json({ error: "The multipart upload request is invalid." }, { status: 400 });
      }
      throw error;
    }
    const storeId = form.get("storeId");
    const file = form.get("file");
    if (typeof storeId !== "string" || !storeId.trim()) {
      return Response.json({ error: "storeId is required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "An image file is required." }, { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, status: true, seller: { select: { status: true, ownerId: true } } }
    });
    if (!store || store.seller.status !== "ACTIVE" || store.status === "SUSPENDED" || store.status === "CLOSED") {
      return Response.json({ error: "An active seller store is required to upload product images." }, { status: 403 });
    }
    if (!(await canManageStoreCatalog(actor.userId, store.seller.ownerId, store.id, new Date()))) {
      return Response.json({ error: "You do not have catalog access to this store." }, { status: 403 });
    }

    const uploaded = await uploadProductImage({
      fileName: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer())
    });
    return Response.json(uploaded, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ProductImageUploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ProductImageValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Product image upload request failed.", error);
    return Response.json({ error: "Product image upload could not be completed." }, { status: 500 });
  }
}
