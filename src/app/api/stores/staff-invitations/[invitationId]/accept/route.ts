import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { acceptStoreStaffInvitation } from "@/server/marketplace/store-staff";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ invitationId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { invitationId } = await context.params;
    const result = await acceptStoreStaffInvitation(invitationId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to accept invitation." }, { status: 400 });
  }
}
