import "server-only";

import { env } from "@/lib/env";

const MAX_JSON_MUTATION_BYTES = 1024 * 1024;
const MAX_MULTIPART_MUTATION_BYTES = 10 * 1024 * 1024 + 256 * 1024;

function declaredBodyTooLarge(request: Request, maximumBytes: number): boolean {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null) return false;
  return !/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes;
}

/** Reject cross-origin state-changing requests before any identity mutation. */
export function validateIdentityMutationOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(env.APP_URL).origin;
  } catch {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  if (origin !== expectedOrigin) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  return null;
}

/** JSON-only mutation guard. Keep this for APIs that parse JSON bodies. */
export function validateIdentityMutationRequest(request: Request): Response | null {
  const originRejected = validateIdentityMutationOrigin(request);
  if (originRejected) return originRejected;
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return Response.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  if (declaredBodyTooLarge(request, MAX_JSON_MUTATION_BYTES)) {
    return Response.json({ error: "Request body exceeds the 1 MB limit." }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

/** Multipart guard for authenticated file uploads; boundary is required by FormData. */
export function validateIdentityImageUploadRequest(request: Request): Response | null {
  const originRejected = validateIdentityMutationOrigin(request);
  if (originRejected) return originRejected;
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return Response.json({ error: "Content-Type must be multipart/form-data." }, { status: 415 });
  }
  if (declaredBodyTooLarge(request, MAX_MULTIPART_MUTATION_BYTES)) {
    return Response.json({ error: "Upload request exceeds the 10 MB file-size limit." }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}
