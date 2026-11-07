import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { requireCurrentSession, AuthenticationRequiredError, MfaEnrollmentRequiredError, MfaVerificationRequiredError } from "@/server/identity/current-session";
import { verifyMfaStepUp } from "@/server/identity/mfa";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const session = await requireCurrentSession();
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Enter a valid six-digit authenticator code." }, { status: 400 });
    const verified = await verifyMfaStepUp(session.userId, session.id, parsed.data.code);
    if (!verified) return Response.json({ error: "The authenticator code is invalid or has already been used." }, { status: 400 });
    return Response.json({ verified: true, expiresInSeconds: 600 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError) return Response.json({ error: "Complete multi-factor authentication before continuing." }, { status: 403 });
    return Response.json({ error: "Unable to verify platform step-up." }, { status: 500 });
  }
}
