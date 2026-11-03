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
  trustedIpAddress?: string | null;
}

interface RateLimitBucket {
  keyHash: string;
  windowStartedAt: Date;
  attemptCount: number;
  blockedUntil: Date | null;
}

function digestSubject(kind: "identifier" | "ip", value: string): string {
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
 * Clears the identifier bucket after a successful authentication so normal
 * repeated sign-ins do not lock out a legitimate account. IP abuse counters
 * are intentionally retained.
 */
export async function clearIdentifierLoginThrottle(
  identifierInput: string
): Promise<void> {
  const identifier = normalizeEmail(identifierInput);
  if (!identifier || identifier.length > 254) return;

  await prisma.loginRateLimitBucket.updateMany({
    where: { keyHash: digestSubject("identifier", identifier) },
    data: {
      windowStartedAt: new Date(),
      attemptCount: 0,
      blockedUntil: null
    }
  });
}

/**
 * Atomically consumes an attempt against identifier and (when supplied) IP
 * buckets. Call before password hashing/verification. After successful
 * authentication, clear the identifier bucket. The caller must pass only a
 * client IP resolved through trusted proxy configuration.
 */
export async function consumeLoginAttempt(
  input: LoginThrottleInput,
  now = new Date()
): Promise<{ blocked: boolean }> {
  const identifier = normalizeEmail(input.identifier);
  if (!identifier || identifier.length > 254) {
    throw new Error("A valid login identifier is required.");
  }

  const identifierKey = digestSubject("identifier", identifier);
  const ip = input.trustedIpAddress?.trim();
  if (ip && ip.length > 64) {
    throw new Error("The trusted client IP value is invalid.");
  }
  const ipKey = ip ? digestSubject("ip", ip) : null;

  return prisma.$transaction(async (tx) => {
    const identifierBlocked = await consumeBucket(
      tx,
      identifierKey,
      IDENTIFIER_LIMIT,
      now
    );

    const ipBlocked = ipKey
      ? await consumeBucket(tx, ipKey, IP_LIMIT, now)
      : false;

    return { blocked: identifierBlocked || ipBlocked };
  });
}
