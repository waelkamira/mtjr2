import { z } from "zod";
import { changeAdminStoreStatus } from "@/server/admin/sellers";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ storeId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const { storeId } = await context.params;
    return Response.json({ result: await changeAdminStoreStatus(storeId, body) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid store status request." }, { status: 400 });
    if (error instanceof Error && error.message === "Store was not found.") return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && /cannot|already|not supported|concurrently/i.test(error.message)) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Unable to update store status." }, { status: 500 });
  }
}
