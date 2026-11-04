import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({ displayName: z.string().trim().min(1).max(80) }).strict();

export async function GET(): Promise<Response> {
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, displayName: true, status: true, emailVerifiedAt: true, createdAt: true }
    });
    if (!user) return Response.json({ error: "Account not found." }, { status: 404 });
    return Response.json({ profile: { ...user, createdAt: user.createdAt.toISOString(), emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a valid display name." }, { status: 400 });
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { displayName: parsed.data.displayName },
      select: { id: true, email: true, displayName: true, status: true }
    });
    return Response.json({ profile: user });
  } catch {
    return Response.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
