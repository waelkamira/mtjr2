import { createHmac } from "node:crypto";
import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { clearLoginThrottle, consumeLoginAttempt } from "@/server/identity/login-throttle";
import { normalizeEmail } from "@/server/identity/normalize-email";
import { getMfaAccessState } from "@/server/identity/mfa";
import { verifyPassword } from "@/server/identity/password";
import { generateSessionToken, hashSessionToken, SESSION_TTL_SECONDS, type CreatedSession } from "@/server/identity/session";

const INVALID_CREDENTIALS = "Email or password is incorrect.";
const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$n0waey5tgDWhyfC01-KmEw$I-smw-3q3v0T4X-sxmksg9yoI156U0atV-DhaGzn4eIP_HHRLelqPP_UksHNTaf7AiDvXxghMW1Og6Bet_BfUQ";

export interface LoginInput {
  email: string;
  password: string;
  trustedIpAddress: string;
  userAgent?: string | null;
}

export type LoginResult =
  | {
      authenticated: true;
      userId: string;
      session: CreatedSession;
      mfaRequired: boolean;
      mfaSetupRequired: boolean;
    }
  | { authenticated: false; reason: "EMAIL_NOT_FOUND" | "INVALID_PASSWORD" | "INVALID_CREDENTIALS" | "RATE_LIMITED"; message: string };

function digestLoginValue(kind: "identifier" | "ip", value: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${kind}:${value}`, "utf8")
    .digest("hex");
}

/**
 * Password login accepts active accounts without requiring email verification.
 * Legacy pending accounts are activated only after successful password proof.
 * The conditional user-row write and session creation share one transaction,
 * so concurrent password changes or account suspensions cannot race a session.
 * MFA remains a separate mandatory step for platform administrators.
 */
export async function loginWithPassword(
  input: LoginInput,
  now = new Date()
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const ip = input.trustedIpAddress.trim();

  if (!email || email.length > 254 || typeof password !== "string" ||
      password.length < 1 || password.length > 128 || !ip || ip.length > 64) {
    return { authenticated: false, reason: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS };
  }

  const throttle = await consumeLoginAttempt({ identifier: email, trustedIpAddress: ip }, now);
  const identifierHash = digestLoginValue("identifier", email);
  const ipHash = digestLoginValue("ip", ip);

  if (throttle.blocked) {
    await prisma.loginAttempt.create({
      data: { identifierHash, ipHash, succeeded: false, attemptedAt: now }
    });
    return { authenticated: false, reason: "RATE_LIMITED", message: "Too many attempts. Try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { emailNormalized: email },
    select: { id: true, passwordHash: true, status: true, adminStatusReason: true }
  });

  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user) {
    await prisma.loginAttempt.create({ data: { identifierHash, ipHash, succeeded: false, attemptedAt: now } });
    return { authenticated: false, reason: "EMAIL_NOT_FOUND", message: INVALID_CREDENTIALS };
  }

  const eligible = (user.status === UserStatus.ACTIVE ||
    (user.status === UserStatus.PENDING && user.adminStatusReason === null)) &&
    user.passwordHash !== null;

  if (!eligible || !passwordMatches) {
    await prisma.loginAttempt.create({
      data: { userId: user.id, identifierHash, ipHash, succeeded: false, attemptedAt: now }
    });
    return {
      authenticated: false,
      reason: eligible ? "INVALID_PASSWORD" : "INVALID_CREDENTIALS",
      message: INVALID_CREDENTIALS
    };
  }

  const mfa = await getMfaAccessState(user.id, now);
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.$transaction(async (tx) => {
    // Conditional update locks the user row until the session is persisted.
    // Password changes and account-state changes use the same row.
    const current = await tx.user.updateMany({
      where: {
        id: user.id,
        status: user.status,
        passwordHash: user.passwordHash,
        adminStatusReason: user.adminStatusReason
      },
      data: { status: UserStatus.ACTIVE, adminStatusReason: null, lastLoginAt: now }
    });
    if (current.count !== 1) return null;

    if (user.status === UserStatus.PENDING) {
      await tx.verificationToken.updateMany({
        where: { userId: user.id, purpose: "EMAIL_VERIFICATION", consumedAt: null },
        data: { consumedAt: now }
      });
    }

    await tx.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        ipAddress: ip.slice(0, 64),
        userAgent: input.userAgent?.slice(0, 512) || null,
        createdAt: now,
        lastSeenAt: now,
        expiresAt
      }
    });
    await tx.loginAttempt.create({
      data: { userId: user.id, identifierHash, ipHash, succeeded: true, attemptedAt: now }
    });
    await tx.auditLog.create({
      data: {
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: "identity.login.succeeded",
        resource: "user",
        resourceId: user.id,
        occurredAt: now,
        metadata: { method: "password" }
      }
    });
    return { token, expiresAt };
  });

  if (!session) {
    await prisma.loginAttempt.create({
      data: { userId: user.id, identifierHash, ipHash, succeeded: false, attemptedAt: now }
    });
    return { authenticated: false, reason: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS };
  }

  await clearLoginThrottle(email, ip);
  return {
    authenticated: true,
    userId: user.id,
    session,
    mfaRequired: mfa.enabled,
    mfaSetupRequired: mfa.enrollmentRequired
  };
}
