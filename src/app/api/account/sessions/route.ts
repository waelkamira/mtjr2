import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { clearSessionCookie, getSessionCookie } from "@/server/identity/session-cookie";
import { hashSessionToken } from "@/server/identity/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const current = await getCurrentSession();
  if (!current) return Response.json({ error: "Authentication required." }, { status: 401 });
  const sessions = await prisma.userSession.findMany({
    where: { userId: current.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 30,
    select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true }
  });
  return Response.json({
    sessions: sessions.map(session => ({ ...session, createdAt: session.createdAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString(), expiresAt: session.expiresAt.toISOString(), isCurrent: session.id === current.id }))
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  const current = await getCurrentSession();
  if (!current) return Response.json({ error: "Authentication required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("sessionId" in body) || typeof body.sessionId !== "string" || !body.sessionId.trim()) {
    return Response.json({ error: "A session ID is required." }, { status: 400 });
  }
  const sessionId = body.sessionId.trim();
  const result = await prisma.userSession.updateMany({
    where: { id: sessionId, userId: current.userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  if (result.count !== 1) return Response.json({ error: "Session not found or already revoked." }, { status: 404 });
  await prisma.auditLog.create({ data: { actorType: "USER", actorId: current.userId, action: "identity.session.revoked", resource: "user_session", resourceId: sessionId, occurredAt: new Date() } });
  if (sessionId === current.id) {
    const token = await getSessionCookie();
    if (token) {
      await prisma.userSession.updateMany({ where: { tokenHash: hashSessionToken(token), userId: current.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await clearSessionCookie();
  }
  return Response.json({ revoked: true, currentSession: sessionId === current.id });
}
