import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
  "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

function config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Cloudflare R2 storage is not configured.");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key: Buffer | string, value: string, encoding?: "hex") {
  return createHmac("sha256", key).update(value).digest(encoding);
}
function signingKey(secret: string, date: string) {
  const dateKey = hmac(`AWS4${secret}`, date) as Buffer;
  const regionKey = hmac(dateKey, "auto") as Buffer;
  const serviceKey = hmac(regionKey, "s3") as Buffer;
  return hmac(serviceKey, "aws4_request") as Buffer;
}
function encodePath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}
function timestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
function endpoint(cfg: R2Config, key: string) {
  return {
    host: `${cfg.accountId}.r2.cloudflarestorage.com`,
    path: `/${encodeURIComponent(cfg.bucket)}/${encodePath(key)}`
  };
}

export function validateAttachmentMetadata(input: { fileName: string; contentType: string; sizeBytes: number }) {
  const fileName = input.fileName.trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255);
  if (!fileName || fileName === "." || fileName === "..") throw new Error("Invalid attachment filename.");
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) throw new Error("This attachment file type is not allowed.");
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("Attachments must be between 1 byte and 10 MB.");
  }
  return { fileName, contentType: input.contentType, sizeBytes: input.sizeBytes };
}

export function newAttachmentObjectKey(scope: "support" | "store-message", parentId: string) {
  return `message-attachments/${scope}/${parentId}/${randomUUID()}`;
}

export function createR2UploadUrl(objectKey: string, contentType: string, now = new Date()) {
  return createPresignedUrl("PUT", objectKey, contentType, now);
}
export function createR2DownloadUrl(objectKey: string, now = new Date()) {
  return createPresignedUrl("GET", objectKey, undefined, now);
}

function createPresignedUrl(method: "GET" | "PUT" | "HEAD" | "DELETE", objectKey: string, contentType?: string, now = new Date()) {
  const cfg = config();
  const { host, path } = endpoint(cfg, objectKey);
  const date = timestamp(now);
  const day = date.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": "600",
    "X-Amz-SignedHeaders": "host"
  });
  const canonicalQuery = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, sha256(canonicalRequest)].join("\n");
  const signature = hmac(signingKey(cfg.secretAccessKey, day), stringToSign, "hex");
  const url = `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  return { url, method, headers: contentType ? { "Content-Type": contentType } : {}, expiresInSeconds: 600 };
}

export async function inspectR2Object(objectKey: string) {
  const signed = createPresignedUrl("HEAD", objectKey);
  const response = await fetch(signed.url, { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error("Uploaded object could not be verified in R2.");
  return {
    sizeBytes: Number(response.headers.get("content-length") ?? 0),
    contentType: response.headers.get("content-type") ?? ""
  };
}

export async function scanR2Object(objectKey: string, metadata: { contentType: string; sizeBytes: number }) {
  const scannerUrl = process.env.ATTACHMENT_SCANNER_URL?.trim();
  const scannerToken = process.env.ATTACHMENT_SCANNER_TOKEN?.trim();
  if (!scannerUrl || !scannerToken) throw new Error("Attachment malware scanner is not configured; the file remains quarantined.");
  const response = await fetch(scannerUrl, {
    method: "POST",
    headers: { "Authorization": `Bearer ${scannerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "cloudflare-r2", bucket: config().bucket, objectKey, ...metadata }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error("Attachment malware scan failed.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("clean" in result) || typeof result.clean !== "boolean") {
    throw new Error("Attachment scanner returned an invalid response.");
  }
  return result.clean;
}
