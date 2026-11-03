import { getCurrentSession } from "@/server/identity/current-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ authenticated: true, userId: session.userId, expiresAt: session.expiresAt.toISOString() });
  } catch {
    return Response.json({ error: "Unable to resolve session." }, { status: 500 });
  }
}
