import { z } from "zod";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { confirmMfaEnrollment, MfaConfigurationError, MfaStateConflictError } from "@/server/identity/mfa";
export const runtime = "nodejs";
const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();
export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a six-digit authenticator code." }, { status: 400 });
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const result = await confirmMfaEnrollment(session.userId, parsed.data.code);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MfaStateConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof MfaConfigurationError) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "Unable to confirm MFA enrollment." }, { status: 500 });
  }
}
