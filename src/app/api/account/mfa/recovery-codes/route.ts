import { z } from "zod";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { MfaStateConflictError, regenerateMfaRecoveryCodes } from "@/server/identity/mfa";
export const runtime = "nodejs";
const schema = z.object({ code: z.string().trim().min(6).max(64) }).strict();
export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter an authenticator or recovery code." }, { status: 400 });
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const recoveryCodes = await regenerateMfaRecoveryCodes(session.userId, parsed.data.code);
    return Response.json({ recoveryCodes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MfaStateConflictError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Unable to regenerate recovery codes." }, { status: 500 });
  }
}
