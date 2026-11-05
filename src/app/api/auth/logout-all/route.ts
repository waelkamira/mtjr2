import { logoutAllSessions } from "@/server/identity/logout";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const revokedSessionCount = await logoutAllSessions();
    return Response.json(
      { loggedOut: true, revokedSessionCount },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return Response.json({ error: "Unable to sign out all devices right now." }, { status: 500 });
  }
}
