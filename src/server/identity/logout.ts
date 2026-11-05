import "server-only";

import { AuditActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { clearSessionCookie, getSessionCookie } from "@/server/identity/session-cookie";
import { resolveUserSession, revokeUserSession } from "@/server/identity/session";

/**
 * Revokes the current cookie-backed session and clears the browser cookie.
 * Safe to call repeatedly; no client-supplied user/session ID is accepted.
 * The HTTP route must still enforce same-origin/CSRF policy before calling.
 */
export async function logoutCurrentSession(now = new Date()): Promise<void> {
  const token = await getSessionCookie();

  try {
    if (!token) return;

    const session = await resolveUserSession(token, now);
    const revoked = await revokeUserSession(token, now);

    if (session && revoked) {
      await prisma.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: session.userId,
          action: "identity.logout.succeeded",
          resource: "user_session",
          resourceId: session.id,
          occurredAt: now
        }
      });
    }
  } finally {
    // Clear even when the session is expired, already revoked, or lookup fails.
    await clearSessionCookie();
  }
}


/** Revokes every active session for the authenticated account, including this device. */
export async function logoutAllSessions(now = new Date()): Promise<number> {
  const token = await getSessionCookie();
  try {
    if (!token) return 0;
    const session = await resolveUserSession(token, now);
    if (!session) return 0;
    const revoked = await prisma.userSession.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: now }
    });
    if (revoked.count > 0) {
      await prisma.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: session.userId,
          action: "identity.logout_all.succeeded",
          resource: "user",
          resourceId: session.userId,
          occurredAt: now,
          metadata: { revokedSessionCount: revoked.count }
        }
      });
    }
    return revoked.count;
  } finally {
    await clearSessionCookie();
  }
}
