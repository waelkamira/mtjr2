import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createMfaEnrollment, MfaConfigurationError, MfaStateConflictError } from "@/server/identity/mfa";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try { await request.json(); } catch { return Response.json({ error: "A JSON body is required." }, { status: 400 }); }
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const enrollment = await createMfaEnrollment(session.userId);
    return Response.json(enrollment, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MfaStateConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof MfaConfigurationError) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "Unable to start MFA enrollment." }, { status: 500 });
  }
}
