import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { revokeStoreStaff } from "@/server/marketplace/store-staff";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ membershipId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { membershipId } = await context.params;
    const revoked = await revokeStoreStaff(membershipId);
    if (!revoked) return Response.json({ error: "Active invitation or membership not found." }, { status: 404 });
    return Response.json({ revoked: true });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to revoke store staff." }, { status: 403 });
  }
}
