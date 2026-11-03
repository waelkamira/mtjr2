import { ZodError } from "zod";
import { env } from "@/lib/env";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { registerUser, IdentityConflictError } from "@/server/identity/registration";
import { consumeVerificationEmailAttempt } from "@/server/identity/login-throttle";
import { resendEmailAdapter } from "@/server/email/resend";

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
  if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
    return Response.json({ error: "Invalid registration details." }, { status: 400 });
  }

  try {
    const limit = await consumeVerificationEmailAttempt({ identifier: body.email, trustedIpAddress: ip });
    if (limit.blocked) return Response.json({ message: "If the details are eligible, an email will be sent." }, { status: 202 });

    const result = await registerUser(body as Parameters<typeof registerUser>[0]);
    const email = body.email.trim().normalize("NFKC").toLowerCase();
    await resendEmailAdapter.sendVerificationEmail(email, result.verificationToken);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid registration details." }, { status: 400 });
    if (error instanceof IdentityConflictError) return Response.json({ message: "If the details are eligible, an email will be sent." }, { status: 202 });
    // Do not disclose whether an account was created or whether delivery failed.
    return Response.json({ message: "Registration could not be completed. Please try again later." }, { status: 503 });
  }

  return Response.json({ message: "If the details are eligible, an email will be sent." }, { status: 202 });
}
