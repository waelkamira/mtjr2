import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { normalizeEmail } from "@/server/identity/normalize-email";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const IDENTIFIER_LIMIT = 5;
const IP_LIMIT = 30;

interface LoginThrottleInput {
  identifier: string;
  /** Must come from the application's trusted proxy/IP resolution layer. */
  trustedIpAddress: string;
}

interface RateLimitBucket {
  keyHash: string;
  windowStartedAt: Date;
  attemptCount: number;
  blockedUntil: Date | null;
}

function digestSubject(kind: string, value: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${kind}:${value}`, "utf8")
    .digest("hex");
}

async function consumeBucket(
  tx: Prisma.TransactionClient,
  keyHash: string,
  limit: number,
  now: Date
): Promise<boolean> {
  let bucket = (await tx.loginRateLimitBucket.upsert({
    where: { keyHash },
    create: {
      keyHash,
      windowStartedAt: now,
      attemptCount: 1
    },
    update: { attemptCount: { increment: 1 } }
  })) as RateLimitBucket;

  const windowExpired =
    bucket.windowStartedAt.getTime() <= now.getTime() - WINDOW_MS;
  const blockExpired =
    bucket.blockedUntil !== null && bucket.blockedUntil.getTime() <= now.getTime();

  if (windowExpired || blockExpired) {
    await tx.loginRateLimitBucket.updateMany({
      where: {
        keyHash,
        OR: [
          { windowStartedAt: { lte: new Date(now.getTime() - WINDOW_MS) } },
          { blockedUntil: { lte: now } }
        ]
      },
      data: {
        windowStartedAt: now,
        attemptCount: 1,
        blockedUntil: null
      }
    });

    bucket = (await tx.loginRateLimitBucket.findUnique({
      where: { keyHash }
    })) as RateLimitBucket;
  }

  if (bucket.blockedUntil && bucket.blockedUntil.getTime() > now.getTime()) {
    return true;
  }

  if (bucket.attemptCount >= limit) {
    const blockedUntil = new Date(now.getTime() + BLOCK_MS);
    await tx.loginRateLimitBucket.updateMany({
      where: {
        keyHash,
        blockedUntil: null,
        attemptCount: { gte: limit }
      },
      data: { blockedUntil }
    });

    const current = (await tx.loginRateLimitBucket.findUnique({
      where: { keyHash }
    })) as RateLimitBucket;

    return current.blockedUntil !== null &&
      current.blockedUntil.getTime() > now.getTime();
  }

  return false;
}

/**
 * Clears the identifier/IP pair bucket after successful authentication.
 * This avoids locking an account globally when an attacker targets its email
 * from unrelated IP addresses. IP abuse counters are intentionally retained.
 */
export async function clearLoginThrottle(
  identifierInput: string,
  trustedIpAddress: string
): Promise<void> {
  const identifier = normalizeEmail(identifierInput);
  const ip = trustedIpAddress.trim();
  if (!identifier || identifier.length > 254 || !ip || ip.length > 64) return;

  const pairKey = digestSubject("identifier-ip", JSON.stringify([identifier, ip]));
  await prisma.loginRateLimitBucket.updateMany({
    where: { keyHash: pairKey },
    data: {
      windowStartedAt: new Date(),
      attemptCount: 0,
      blockedUntil: null
    }
  });
}

/**
 * Atomically consumes an attempt against an identifier/IP pair bucket and
 * an IP-wide bucket. Call before password hashing/verification. After
 * successful authentication, clear only the pair bucket. The caller must
 * pass a client IP resolved through trusted proxy configuration.
 */
export async function consumeLoginAttempt(
  input: LoginThrottleInput,
  now = new Date()
): Promise<{ blocked: boolean }> {
  const identifier = normalizeEmail(input.identifier);
  if (!identifier || identifier.length > 254) {
    throw new Error("A valid login identifier is required.");
  }

  const ip = input.trustedIpAddress.trim();
  if (!ip || ip.length > 64) {
    throw new Error("A trusted client IP value is required.");
  }
  const pairKey = digestSubject("identifier-ip", JSON.stringify([identifier, ip]));
  const ipKey = digestSubject("ip", ip);

  return prisma.$transaction(async (tx) => {
    const pairBlocked = await consumeBucket(
      tx,
      pairKey,
      IDENTIFIER_LIMIT,
      now
    );
    const ipBlocked = await consumeBucket(tx, ipKey, IP_LIMIT, now);

    return { blocked: pairBlocked || ipBlocked };
  });
}

/**
 * Separate abuse budget for password-reset requests. The action namespace is
 * included in both HMAC keys so reset traffic cannot consume login attempts or
 * clear/extend login lockouts. Uses the same persistent bucket implementation.
 */
export async function consumePasswordResetAttempt(
  input: LoginThrottleInput,
  now = new Date()
): Promise<{ blocked: boolean }> {
  const identifier = normalizeEmail(input.identifier);
  if (!identifier || identifier.length > 254) {
    throw new Error("A valid reset identifier is required.");
  }

  const ip = input.trustedIpAddress.trim();
  if (!ip || ip.length > 64) {
    throw new Error("A trusted client IP value is required.");
  }

  const pairKey = digestSubject(
    "password-reset-identifier-ip",
    JSON.stringify([identifier, ip])
  );
  const ipKey = digestSubject("password-reset-ip", ip);

  return prisma.$transaction(async (tx) => {
    const pairBlocked = await consumeBucket(tx, pairKey, 3, now);
    const ipBlocked = await consumeBucket(tx, ipKey, 10, now);
    return { blocked: pairBlocked || ipBlocked };
  });
}


/** Separate persistent abuse budget for verification-email sends. */
export async function consumeVerificationEmailAttempt(
  input: LoginThrottleInput,
  now = new Date()
): Promise<{ blocked: boolean }> {
  const identifier = normalizeEmail(input.identifier);
  if (!identifier || identifier.length > 254) {
    throw new Error("A valid verification identifier is required.");
  }
  const ip = input.trustedIpAddress.trim();
  if (!ip || ip.length > 64) {
    throw new Error("A trusted client IP value is required.");
  }

  const pairKey = digestSubject(
    "verification-email-identifier-ip",
    JSON.stringify([identifier, ip])
  );
  const ipKey = digestSubject("verification-email-ip", ip);

  return prisma.$transaction(async (tx) => {
    const pairBlocked = await consumeBucket(tx, pairKey, 3, now);
    const ipBlocked = await consumeBucket(tx, ipKey, 10, now);
    return { blocked: pairBlocked || ipBlocked };
  });
}

/** Persistent per-IP budget for public search and autocomplete requests. */
export async function consumeSearchAttempt(
  trustedIpAddress: string,
  now = new Date()
): Promise<{ blocked: boolean }> {
  const ip = trustedIpAddress.trim();
  if (!ip || ip.length > 64) throw new Error("A trusted client IP value is required.");
  const key = digestSubject("search-ip", ip);
  return prisma.$transaction(async (tx) => ({
    blocked: await consumeBucket(tx, key, 300, now)
  }));
}
