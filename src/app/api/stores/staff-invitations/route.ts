import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listMyStaffInvitations } from "@/server/marketplace/store-staff";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listMyStaffInvitations() });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load invitations." }, { status: 403 });
  }
}
