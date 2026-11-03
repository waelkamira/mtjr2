import { env } from "@/lib/env";
import { setSessionCookie } from "@/server/identity/session-cookie";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { loginWithPassword } from "@/server/identity/login";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  const ip = resolveTrustedClientIp(request.headers, env.TRUSTED_PROXY_IP_HEADER);
  if (!ip) return Response.json({ error: "Identity service is not configured." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body) ||
      typeof body.email !== "string" || typeof body.password !== "string") {
    return Response.json({ error: "Invalid credentials." }, { status: 400 });
  }

  const result = await loginWithPassword({
    email: body.email,
    password: body.password,
    trustedIpAddress: ip,
    userAgent: request.headers.get("user-agent")
  });

  if (!result.authenticated) {
    return Response.json(
      { error: result.reason === "RATE_LIMITED" ? "Too many attempts. Try again later." : "Email or password is incorrect." },
      { status: result.reason === "RATE_LIMITED" ? 429 : 401 }
    );
  }

  await setSessionCookie(result.session.token, result.session.expiresAt);
  return Response.json({ authenticated: true });
}
