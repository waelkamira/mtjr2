import { env } from "@/lib/env";
import { resendEmailAdapter } from "@/server/email/resend";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { consumeVerificationEmailAttempt } from "@/server/identity/login-throttle";
import { issueVerificationEmailChallenge } from "@/server/identity/verification-email";

export const runtime = "nodejs";

const GENERIC_RESPONSE = { message: "If the account is eligible, a verification email will be sent." };

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
    return Response.json({ error: "Invalid email address." }, { status: 400 });
  }

  try {
    const throttle = await consumeVerificationEmailAttempt({
      identifier: body.email,
      trustedIpAddress: ip
    });
    if (!throttle.blocked) {
      const challenge = await issueVerificationEmailChallenge(body.email);
      if (challenge) {
        await resendEmailAdapter.sendVerificationEmail(challenge.email, challenge.token);
      }
    }
  } catch {
    // Keep account state and mail-provider failures out of the public response.
  }

  return Response.json(GENERIC_RESPONSE, { status: 202 });
}
