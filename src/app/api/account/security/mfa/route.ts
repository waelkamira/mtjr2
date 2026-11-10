import { z } from "zod";
import { env } from "@/lib/env";
import { getCurrentSession } from "@/server/identity/current-session";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  getMfaAccessState,
  isMfaVerificationFresh,
  verifyMfaSession
} from "@/server/identity/mfa";
import {
  clearLoginThrottle,
  consumeLoginAttempt
} from "@/server/identity/login-throttle";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setup"),
    currentPassword: z.string().min(1).max(128)
  }).strict(),
  z.object({
    action: z.literal("confirm"),
    code: z.string().min(6).max(6)
  }).strict(),
  z.object({
    action: z.literal("verify"),
    code: z.string().min(1).max(32)
  }).strict(),
  z.object({
    action: z.literal("disable"),
    currentPassword: z.string().min(1).max(128),
    code: z.string().min(1).max(32)
  }).strict()
]);

export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });

  const state = await getMfaAccessState(session.userId);
  return Response.json({
    enabled: state.enabled,
    required: state.required,
    platformRequired: state.platformRequired,
    privilegedAccountRequired: state.privilegedAccountRequired,
    enrollmentRequired: state.enrollmentRequired,
    verified: state.enabled && isMfaVerificationFresh(session.mfaVerifiedAt)
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid multi-factor authentication request." }, { status: 400 });

  const { action } = parsed.data;
  const trustedIpAddress = resolveTrustedClientIp(
    request.headers,
    env.TRUSTED_PROXY_IP_HEADER,
    env.NODE_ENV
  );
  if (!trustedIpAddress) {
    return Response.json({ error: "Identity service is not configured." }, { status: 503 });
  }
  const throttle = await consumeLoginAttempt({
    identifier: session.user.email,
    trustedIpAddress
  });
  if (throttle.blocked) {
    return Response.json({ error: "Too many verification attempts. Try again later." }, { status: 429 });
  }

  if (action === "setup") {
    const result = await beginMfaEnrollment(session.userId, parsed.data.currentPassword);
    if (result.status !== "READY") {
      const status = result.status === "INVALID_PASSWORD" ? 401 : 409;
      return Response.json({ error: result.status }, { status });
    }
    await clearLoginThrottle(session.user.email, trustedIpAddress);
    return Response.json({
      secret: result.secret,
      otpauthUri: result.otpauthUri
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "confirm") {
    const recoveryCodes = await confirmMfaEnrollment(
      session.userId,
      session.id,
      parsed.data.code
    );
    if (!recoveryCodes) {
      return Response.json({ error: "The authenticator code is invalid or expired." }, { status: 400 });
    }
    await clearLoginThrottle(session.user.email, trustedIpAddress);
    return Response.json({ enabled: true, recoveryCodes }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (action === "verify") {
    const verified = await verifyMfaSession(
      session.userId,
      session.id,
      parsed.data.code
    );
    if (!verified) {
      return Response.json({ error: "The authenticator or recovery code is invalid." }, { status: 400 });
    }
    await clearLoginThrottle(session.user.email, trustedIpAddress);
    return Response.json({ verified: true });
  }

  const result = await disableMfa(
    session.userId,
    session.id,
    parsed.data.currentPassword,
    parsed.data.code
  );
  if (result !== "DISABLED") {
    const status = result === "INVALID_PASSWORD" ? 401 :
      result === "INVALID_CODE" ? 400 :
        result === "SESSION_CHANGED" ? 401 :
        result === "MFA_REQUIRED" ? 403 : 409;
    return Response.json({ error: result }, { status });
  }
  await clearLoginThrottle(session.user.email, trustedIpAddress);
  return Response.json({ enabled: false });
}
