import { z } from "zod";
import { env } from "@/lib/env";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { clearMfaThrottle, consumeMfaAttempt } from "@/server/identity/login-throttle";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { disableMfa, getMfaStatus, MfaConfigurationError, MfaStateConflictError } from "@/server/identity/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  return Response.json({ status: await getMfaStatus(session.userId) }, { headers: { "Cache-Control": "private, no-store" } });
}

const disableSchema = z.object({ currentPassword: z.string().min(1).max(128), code: z.string().trim().min(6).max(64) }).strict();
export async function DELETE(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = disableSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter your current password and MFA code." }, { status: 400 });
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  const ip = resolveTrustedClientIp(request.headers, env.TRUSTED_PROXY_IP_HEADER, env.NODE_ENV);
  if (!ip) return Response.json({ error: "MFA verification is not configured for this network." }, { status: 503 });
  const throttle = await consumeMfaAttempt({ identifier: session.user.email, trustedIpAddress: ip });
  if (throttle.blocked) return Response.json({ error: "Too many MFA attempts. Try again later." }, { status: 429 });
  try {
    await disableMfa(session.userId, parsed.data.currentPassword, parsed.data.code);
    await clearMfaThrottle(session.user.email, ip);
    return Response.json({ disabled: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MfaStateConflictError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Unable to disable MFA." }, { status: error instanceof MfaConfigurationError ? 503 : 500 });
  }
}
