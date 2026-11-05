import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { UserStatus } from "@prisma/client";

export const SESSION_COOKIE_NAME = "mtjr2_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Generates a 256-bit opaque bearer token. Store only its SHA-256 digest. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hashes a raw session token before any database lookup or persistence. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function boundedMetadata(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  return value.slice(0, maxLength);
}

export async function createUserSession(
  userId: string,
  metadata: SessionMetadata = {},
  now = new Date()
): Promise<CreatedSession> {
  if (!userId.trim()) throw new Error("A user ID is required.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new Error("Only active accounts can create sessions.");
  }

  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      ipAddress: boundedMetadata(metadata.ipAddress, 64),
      userAgent: boundedMetadata(metadata.userAgent, 512),
      createdAt: now,
      lastSeenAt: now,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
  expiresAt: Date;
  stepUpVerifiedAt: Date | null;
  stepUpExpiresAt: Date | null;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    status: UserStatus;
    emailVerifiedAt: Date | null;
  };
}

export async function resolveUserSession(
  token: string | null | undefined,
  now = new Date()
): Promise<AuthenticatedSession | null> {
  if (!token || token.length < 32 || token.length > 256) return null;

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      stepUpVerifiedAt: true,
      stepUpExpiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          emailVerifiedAt: true
        }
      }
    }
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now.getTime() ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    return null;
  }

  const touched = await prisma.userSession.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      expiresAt: { gt: now },
      // Recheck account state in the same write that accepts the session.
      user: { is: { status: UserStatus.ACTIVE } }
    },
    data: { lastSeenAt: now }
  });

  // Re-check the revocation/expiry predicate atomically before accepting the
  // session. This avoids authenticating a session revoked during the read.
  if (touched.count !== 1) return null;

  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    stepUpVerifiedAt: session.stepUpVerifiedAt,
    stepUpExpiresAt: session.stepUpExpiresAt,
    user: session.user
  };
}

export async function revokeUserSession(
  token: string | null | undefined,
  now = new Date()
): Promise<boolean> {
  if (!token || token.length < 32 || token.length > 256) return false;

  const result = await prisma.userSession.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null
    },
    data: { revokedAt: now }
  });

  return result.count === 1;
}

export async function revokeAllUserSessions(
  userId: string,
  now = new Date()
): Promise<number> {
  if (!userId.trim()) throw new Error("A user ID is required.");

  const result = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now }
  });

  return result.count;
}
