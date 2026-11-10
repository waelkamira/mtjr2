import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createUserAddress, listUserAddresses } from "@/server/account/addresses";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ addresses: await listUserAddresses() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const status = cause instanceof AuthenticationRequiredError ? 401 : 500;
    return Response.json({ error: status === 401 ? "Sign in to manage saved addresses." : "Unable to load saved addresses." }, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ address: await createUserAddress(body) }, { status: 201 });
  } catch (cause) {
    const status = cause instanceof AuthenticationRequiredError ? 401 : 400;
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to save address." }, { status });
  }
}
