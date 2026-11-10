import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/current-session";
import { logoutAllSessions } from "@/server/identity/logout";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const revokedSessions = await logoutAllSessions();
    return Response.json({ revokedSessions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError) {
      return Response.json({ error: "Complete multi-factor authentication before managing sessions." }, { status: 403 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Unable to revoke sessions." }, { status: 500 });
  }
}
