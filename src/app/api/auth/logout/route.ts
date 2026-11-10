import { logoutCurrentSession } from "@/server/identity/logout";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    await logoutCurrentSession();
    return Response.json({ message: "Signed out." });
  } catch {
    return Response.json({ error: "Unable to sign out right now." }, { status: 500 });
  }
}
