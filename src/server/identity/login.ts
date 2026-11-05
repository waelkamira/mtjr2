import { createHmac } from "node:crypto";
import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { clearLoginThrottle, consumeLoginAttempt } from "@/server/identity/login-throttle";
import { normalizeEmail } from "@/server/identity/normalize-email";
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
  | { authenticated: true; userId: string; session: CreatedSession }
  | { authenticated: false; reason: "EMAIL_NOT_FOUND" | "INVALID_PASSWORD" | "INVALID_CREDENTIALS" | "RATE_LIMITED"; message: string };

function digestLoginValue(kind: "identifier" | "ip", value: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${kind}:${value}`, "utf8")
    .digest("hex");
}

/**
 * Authenticates an email/password pair. Call only after the HTTP boundary has
 * resolved the client IP through explicitly trusted proxy configuration.
 * The response distinguishes an unknown email from an incorrect password for
 * an eligible account; inactive and unverified accounts retain a generic failure.
 */
export async function loginWithPassword(
  input: LoginInput,
  now = new Date()
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const ip = input.trustedIpAddress.trim();

  if (
    !email ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 128 ||
    !ip ||
    ip.length > 64
  ) {
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
    select: {
      id: true,
      passwordHash: true,
      status: true,
      emailVerifiedAt: true
    }
  });

  // Always perform one scrypt verification, including for unknown users.
  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );
  const eligible =
    user !== null &&
    user.status === UserStatus.ACTIVE &&
    user.emailVerifiedAt !== null &&
    user.passwordHash !== null;

  if (!user) {
    await prisma.loginAttempt.create({ data: { identifierHash, ipHash, succeeded: false, attemptedAt: now } });
    return { authenticated: false, reason: "EMAIL_NOT_FOUND", message: "No account was found with this email address." };
  }

  if (!eligible || !passwordMatches) {
    await prisma.loginAttempt.create({
      data: {
        userId: user?.id ?? null,
        identifierHash,
        ipHash,
        succeeded: false,
        attemptedAt: now
      }
    });
    return { authenticated: false, reason: eligible ? "INVALID_PASSWORD" : "INVALID_CREDENTIALS", message: eligible ? "The password is incorrect. Please try again." : INVALID_CREDENTIALS };
  }

  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.$transaction(async (tx) => {
    // The conditional write locks the user row until the session is created.
    // Password changes use the same row, so they either revoke this session
    // afterward or cause this check to fail before it can be issued.
    const current = await tx.user.updateMany({
      where: { id: user.id, status: UserStatus.ACTIVE, emailVerifiedAt: { not: null }, passwordHash: user.passwordHash },
      data: { lastLoginAt: now }
    });
    if (current.count !== 1) return null;
    await tx.userSession.create({ data: {
      userId: user.id, tokenHash: hashSessionToken(token),
      userAgent: input.userAgent?.slice(0, 512) || null,
      createdAt: now, lastSeenAt: now, expiresAt
    } });
    await tx.loginAttempt.create({
        data: {
          userId: user.id,
          identifierHash,
          ipHash,
          succeeded: true,
          attemptedAt: now
        }
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
    await prisma.loginAttempt.create({ data: { userId: user.id, identifierHash, ipHash, succeeded: false, attemptedAt: now } });
    return { authenticated: false, reason: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS };
  }

  await clearLoginThrottle(email, ip);
  return { authenticated: true, userId: user.id, session };
}
