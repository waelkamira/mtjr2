import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/current-session";
import { updateStoreShippingRate } from "@/server/shipping/shipping";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { id } = await context.params;
    return Response.json(await updateStoreShippingRate(id, body));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Shipping configuration access denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid shipping rate.", issues: error.issues }, { status: 400 });
    if (error instanceof Error && error.message.includes("active market and currency")) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message.includes("not found")) return Response.json({ error: "Shipping service not found." }, { status: 404 });
    return Response.json({ error: "Unable to update shipping rate." }, { status: 500 });
  }
}
