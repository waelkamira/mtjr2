import { z } from "zod";
import { updateUserAddress, deleteUserAddress } from "@/server/account/addresses";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ error: "Sign in to manage saved addresses." }, { status: 401 });
  }
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Invalid address.", issues: error.issues }, { status: 400 });
  }
  if (error instanceof Error && error.message === "Saved address not found.") {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error && /country is not available|address changed|new default address/.test(error.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Unable to manage saved address." }, { status: 500 });
}

/** Updates one address after same-origin validation and server-side owner resolution. */
export async function PATCH(request: Request, context: { params: Promise<{ addressId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { addressId } = await context.params;
    return Response.json({ address: await updateUserAddress(addressId, body) });
  } catch (error) {
    return failure(error);
  }
}

/** Deletes one address owned by the current user and returns the promoted default, if any. */
export async function DELETE(request: Request, context: { params: Promise<{ addressId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { addressId } = await context.params;
    return Response.json(await deleteUserAddress(addressId));
  } catch (error) {
    return failure(error);
  }
}
