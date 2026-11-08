import { randomUUID } from "node:crypto";
import { AuthenticationRequiredError, requireCurrentSession } from "@/server/identity/current-session";
import { validateIdentityImageUploadRequest, validateIdentityMutationOrigin } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};

async function hasValidImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (file.type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (file.type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (file.type === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (file.type === "image/avif") return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 && bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66;
  return false;
}

export async function POST(request: Request): Promise<Response> {
  const originRejected = validateIdentityMutationOrigin(request);
  if (originRejected) return originRejected;
  let actor: Awaited<ReturnType<typeof requireCurrentSession>>;
  try {
    actor = await requireCurrentSession();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Unable to verify the current session." }, { status: 401 });
  }
  const contentTypeRejected = validateIdentityImageUploadRequest(request);
  if (contentTypeRejected) return contentTypeRejected;
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "A multipart upload is required." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an identity document image." }, { status: 400 });
  if (!Object.hasOwn(MIME_EXTENSIONS, file.type)) return Response.json({ error: "Use JPG, PNG, WebP or AVIF." }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: "The identity image must be no larger than 4 MB." }, { status: 413 });
  if (!(await hasValidImageSignature(file))) return Response.json({ error: "The file content does not match its image type." }, { status: 415 });

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!privateKey) return Response.json({ error: "Private identity document storage is not configured." }, { status: 503 });
  const formData = new FormData();
  formData.append("file", file, "seller-identity." + MIME_EXTENSIONS[file.type]);
  formData.append("fileName", "seller-identity-" + randomUUID() + "." + MIME_EXTENSIONS[file.type]);
  formData.append("folder", "/matjar/private-seller-identity");
  formData.append("isPrivateFile", "true");
  formData.append("useUniqueFileName", "false");
  formData.append("tags", ["matjar-seller-identity", "user-" + actor.userId].join(","));
  try {
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(privateKey + ":").toString("base64") },
      body: formData,
      signal: AbortSignal.timeout(30_000)
    });
    const payload = await response.json().catch(() => null) as { fileId?: string; isPrivateFile?: boolean } | null;
    if (!response.ok || !payload?.fileId || payload.isPrivateFile !== true) {
      return Response.json({ error: "The private identity upload could not be confirmed." }, { status: 502 });
    }
    return Response.json({ fileId: payload.fileId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The identity document could not be uploaded right now." }, { status: 502 });
  }
}
