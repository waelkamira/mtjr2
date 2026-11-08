import "server-only";

import { env } from "@/lib/env";

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
  if (!/^application\\/json(?:\\s*;|$)/i.test(contentType)) {
    return Response.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  return null;
}

/** Multipart guard for authenticated file uploads; boundary is required by FormData. */
export function validateIdentityImageUploadRequest(request: Request): Response | null {
  const originRejected = validateIdentityMutationOrigin(request);
  if (originRejected) return originRejected;
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\\/form-data\\s*;/i.test(contentType)) {
    return Response.json({ error: "Content-Type must be multipart/form-data." }, { status: 415 });
  }
  return null;
}
