import { env } from "@/lib/env";
import { resendEmailAdapter } from "@/server/email/resend";
import { requestPasswordReset } from "@/server/identity/password-reset";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

const RESPONSE = { message: "If an eligible account exists, password reset instructions will be sent." };

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  const ip = resolveTrustedClientIp(request.headers, env.TRUSTED_PROXY_IP_HEADER, env.NODE_ENV);
  if (!ip) return Response.json({ error: "Identity service is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }
  try {
    const challenge = await requestPasswordReset(body.email, ip);
    if (challenge) {
      try { await resendEmailAdapter.sendPasswordResetEmail(body.email.trim().toLowerCase(), challenge.token); }
      catch { /* Keep public response generic and do not disclose provider details. */ }
    }
  } catch { /* Generic response avoids exposing account/provider state. */ }
  return Response.json(RESPONSE, { status: 202 });
}
