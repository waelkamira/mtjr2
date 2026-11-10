import "server-only";

import { AuditActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { clearSessionCookie, getSessionCookie } from "@/server/identity/session-cookie";
import { resolveUserSession, revokeUserSession } from "@/server/identity/session";
import { requireCurrentSession } from "@/server/identity/current-session";

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

/**
 * Revokes every active session belonging to the authenticated user, including
 * the current session, and clears the current browser cookie.
 */
export async function logoutAllSessions(now = new Date()): Promise<number> {
  const actor = await requireCurrentSession(now);
  try {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.userSession.updateMany({
        where: { userId: actor.userId, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorId: actor.userId,
          action: "identity.logout_all.succeeded",
          resource: "user_session",
          resourceId: actor.id,
          occurredAt: now,
          metadata: { revokedSessions: result.count }
        }
      });
      return result.count;
    });
  } finally {
    await clearSessionCookie();
  }
}
