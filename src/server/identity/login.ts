import { createHmac } from "node:crypto";
import { AuditActorType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { clearLoginThrottle, consumeLoginAttempt } from "@/server/identity/login-throttle";
import { normalizeEmail } from "@/server/identity/normalize-email";
import { verifyPassword } from "@/server/identity/password";
import { createUserSession, type CreatedSession } from "@/server/identity/session";

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
  | { authenticated: false; reason: "INVALID_CREDENTIALS" | "RATE_LIMITED"; message: string };

function digestLoginValue(kind: "identifier" | "ip", value: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${kind}:${value}`, "utf8")
    .digest("hex");
}

/**
 * Authenticates an email/password pair. Call only after the HTTP boundary has
 * resolved the client IP through explicitly trusted proxy configuration.
 * The same public failure is returned for unknown, unverified, inactive, and
 * incorrect-password accounts.
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

  if (!user || !eligible || !passwordMatches) {
    await prisma.loginAttempt.create({
      data: {
        userId: user?.id ?? null,
        identifierHash,
        ipHash,
        succeeded: false,
        attemptedAt: now
      }
    });
    return { authenticated: false, reason: "INVALID_CREDENTIALS", message: INVALID_CREDENTIALS };
  }

  const session = await createUserSession(user.id, {
    userAgent: input.userAgent,
  }, now);

  try {
    await prisma.$transaction([
      prisma.loginAttempt.create({
        data: {
          userId: user.id,
          identifierHash,
          ipHash,
          succeeded: true,
          attemptedAt: now
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now }
      }),
      prisma.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: "identity.login.succeeded",
          resource: "user",
          resourceId: user.id,
          occurredAt: now,
          metadata: { method: "password" }
        }
      })
    ]);
  } catch (error) {
    // Do not leave an issued session behind if the login audit/persistence
    // transaction fails.
    const { revokeUserSession } = await import("@/server/identity/session");
    await revokeUserSession(session.token, now);
    throw error;
  }

  await clearLoginThrottle(email, ip);
  return { authenticated: true, userId: user.id, session };
}
