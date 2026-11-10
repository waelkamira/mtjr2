import { cookies } from "next/headers";
import { env, isPublicRegistrationEnabled } from "@/lib/env";
import {
  createRegistrationChallengeCookie,
  REGISTRATION_CHALLENGE_COOKIE,
  REGISTRATION_CHALLENGE_TTL_SECONDS
} from "@/server/identity/registration-challenge";
import { consumeRegistrationIpAttempt } from "@/server/identity/login-throttle";
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
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("turnstileToken" in body) || typeof body.turnstileToken !== "string") {
    return Response.json({ error: "Please complete the bot check and try again." }, { status: 400 });
  }
  const throttle = await consumeRegistrationIpAttempt(trustedIpAddress);
  if (throttle.blocked) {
    return Response.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
  }

  let challengeValid: boolean;
  try {
    challengeValid = await verifyRegistrationChallenge(body.turnstileToken, trustedIpAddress);
  } catch {
    return Response.json({ error: "Registration bot protection is temporarily unavailable." }, { status: 503 });
  }
  if (!challengeValid) {
    return Response.json({ error: "Please complete the bot check and try again." }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(REGISTRATION_CHALLENGE_COOKIE, createRegistrationChallengeCookie(), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REGISTRATION_CHALLENGE_TTL_SECONDS
  });
  return Response.json({ message: "Bot check complete." });
}
