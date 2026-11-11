import { randomUUID } from "node:crypto";
import { AuthenticationRequiredError, requireCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationOrigin } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const DOCUMENT_TYPES = {
  businessRegistration: { tag: "matjar-seller-business-registration", prefix: "business-registration" },
  taxCertificate: { tag: "matjar-seller-tax-certificate", prefix: "tax-certificate" },
  proofOfAddress: { tag: "matjar-seller-proof-of-address", prefix: "proof-of-address" }
} as const;
const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};

async function hasValidSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (file.type === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46, 0x2d);
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
  if (!actor.user.emailVerifiedAt) return Response.json({ error: "Verify your email address before uploading business documents." }, { status: 403 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE + 128 * 1024) return Response.json({ error: "The document must be no larger than 8 MB." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "A multipart upload is required." }, { status: 400 }); }
  const type = form.get("documentType");
  if (typeof type !== "string" || !Object.hasOwn(DOCUMENT_TYPES, type)) return Response.json({ error: "Choose a supported business document type." }, { status: 400 });
  const config = DOCUMENT_TYPES[type as keyof typeof DOCUMENT_TYPES];
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a document file." }, { status: 400 });
  if (!Object.hasOwn(MIME_EXTENSIONS, file.type)) return Response.json({ error: "Use PDF, JPG, PNG, WebP or AVIF." }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: "The document must be no larger than 8 MB." }, { status: 413 });
  if (!(await hasValidSignature(file))) return Response.json({ error: "The file content does not match its document type." }, { status: 415 });

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!privateKey) return Response.json({ error: "Private document storage is not configured." }, { status: 503 });
  const extension = MIME_EXTENSIONS[file.type];
  const formData = new FormData();
  formData.append("file", file, config.prefix + "." + extension);
  formData.append("fileName", config.prefix + "-" + randomUUID() + "." + extension);
  formData.append("folder", "/matjar/private-seller-verification");
  formData.append("isPrivateFile", "true");
  formData.append("useUniqueFileName", "false");
  formData.append("tags", [config.tag, "user-" + actor.userId].join(","));
  try {
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(privateKey + ":").toString("base64") },
      body: formData,
      signal: AbortSignal.timeout(30_000)
    });
    const payload = await response.json().catch(() => null) as { fileId?: string } | null;
    if (!response.ok || !payload?.fileId) return Response.json({ error: "The private business document could not be uploaded." }, { status: 502 });

    const detailsResponse = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(payload.fileId)}/details`, {
      headers: { Authorization: "Basic " + Buffer.from(privateKey + ":").toString("base64") },
      signal: AbortSignal.timeout(10000),
      cache: "no-store"
    });
    if (!detailsResponse.ok) return Response.json({ error: "The uploaded document could not be verified." }, { status: 502 });
    const details = await detailsResponse.json() as { isPrivateFile?: boolean; tags?: string[] | null };
    if (!details.isPrivateFile || !(details.tags ?? []).includes(config.tag) || !(details.tags ?? []).includes("user-" + actor.userId)) {
      return Response.json({ error: "The uploaded document failed privacy and ownership verification." }, { status: 502 });
    }
    return Response.json({ fileId: payload.fileId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The business document could not be uploaded right now." }, { status: 502 });
  }
}
