import { z } from "zod";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createMfaEnrollment, MfaConfigurationError, MfaStateConflictError } from "@/server/identity/mfa";
export const runtime = "nodejs";
const schema = z.object({ currentPassword: z.string().min(1).max(128) }).strict();
export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Confirm your current password to enroll MFA." }, { status: 400 });
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const enrollment = await createMfaEnrollment(session.userId, parsed.data.currentPassword);
    return Response.json(enrollment, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MfaStateConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof MfaConfigurationError) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "Unable to start MFA enrollment." }, { status: 500 });
  }
}
