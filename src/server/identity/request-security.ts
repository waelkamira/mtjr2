import "server-only";

import { env } from "@/lib/env";

/**
 * Reject cross-origin or non-JSON state-changing requests before any identity
 * mutation. All public identity mutations must call this before parsing bodies
 * or invoking domain services. Missing Origin fails closed.
 */
export function validateIdentityMutationRequest(
  request: Request
): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return Response.json(
      { error: "Request origin could not be verified." },
      { status: 403 }
    );
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin;
  } catch {
    return Response.json(
      { error: "Request origin could not be verified." },
      { status: 403 }
    );
  }

  if (origin !== expectedOrigin) {
    return Response.json(
      { error: "Request origin could not be verified." },
      { status: 403 }
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return Response.json(
      { error: "Content-Type must be application/json." },
      { status: 415 }
    );
  }

  return null;
}
