import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { logoutCurrentSession } from "@/server/identity/logout";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  await logoutCurrentSession();
  return Response.json({ loggedOut: true });
}
