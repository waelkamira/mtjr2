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
