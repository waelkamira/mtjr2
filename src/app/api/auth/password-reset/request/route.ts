import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { resendEmailAdapter } from "@/server/email/resend";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { requestPasswordReset } from "@/server/identity/password-reset";

export const runtime = "nodejs";

const GENERIC_RESPONSE = { message: "If an eligible account exists, password reset instructions will be sent." };

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
    return Response.json({ error: "Invalid email address." }, { status: 400 });
  }

  try {
    const challenge = await requestPasswordReset(body.email, ip);
    if (challenge) {
      const user = await prisma.user.findUnique({
        where: { id: challenge.userId },
        select: { email: true }
      });
      if (user) await resendEmailAdapter.sendPasswordResetEmail(user.email, challenge.token);
    }
  } catch {
    // Preserve the same public response for unknown, throttled and eligible accounts.
  }

  return Response.json(GENERIC_RESPONSE, { status: 202 });
}
