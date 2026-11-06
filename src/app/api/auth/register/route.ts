import { ZodError } from "zod";
import { env, isPublicRegistrationEnabled } from "@/lib/env";
import { resendEmailAdapter } from "@/server/email/resend";
import { IdentityConflictError, registerUser } from "@/server/identity/registration";
import { consumeRegistrationAttempt } from "@/server/identity/login-throttle";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { verifyRegistrationChallenge } from "@/server/identity/turnstile";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isPublicRegistrationEnabled(env)) {
    return Response.json({ error: "Account registration is temporarily unavailable." }, { status: 503 });
  }
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  if (!env.TURNSTILE_SECRET_KEY || !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return Response.json({ error: "Registration bot protection is not configured." }, { status: 503 });
  }
  const trustedIpAddress = resolveTrustedClientIp(request.headers, env.TRUSTED_PROXY_IP_HEADER, env.NODE_ENV);
  if (!trustedIpAddress) return Response.json({ error: "Identity service is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid registration details." }, { status: 400 });
    const data = body as Record<string, unknown>;
    if (typeof data.email !== "string" || typeof data.turnstileToken !== "string") {
      return Response.json({ error: "Invalid registration details." }, { status: 400 });
    }
    if (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      return Response.json({ error: "A valid email address is required." }, { status: 400 });
    }
    const throttle = await consumeRegistrationAttempt({ identifier: data.email, trustedIpAddress });
    if (throttle.blocked) {
      return Response.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
    }

    let challengeValid: boolean;
    try {
      challengeValid = await verifyRegistrationChallenge(data.turnstileToken, trustedIpAddress);
    } catch {
      return Response.json({ error: "Registration bot protection is temporarily unavailable." }, { status: 503 });
    }
    if (!challengeValid) {
      return Response.json({ error: "Please complete the bot check and try again." }, { status: 400 });
    }

    delete data.turnstileToken;
    const result = await registerUser(data as Parameters<typeof registerUser>[0]);
    try {
      await resendEmailAdapter.sendVerificationEmail(data.email.trim().toLowerCase(), result.verificationToken);
    } catch {
      return Response.json({ message: "Account created. Email delivery is temporarily unavailable; request a verification email again later." }, { status: 202 });
    }
    return Response.json({ message: "Account created. Check your email to verify your address." }, { status: 201 });
  } catch (error) {
    if (error instanceof IdentityConflictError) {
      return Response.json({ error: "An account with this email address already exists. Sign in or use password recovery instead.", code: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }
    if (error instanceof ZodError) return Response.json({ error: "Invalid registration details." }, { status: 400 });
    return Response.json({ error: "Unable to complete registration." }, { status: 500 });
  }
}
