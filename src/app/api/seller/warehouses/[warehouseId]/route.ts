import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { updateWarehouse } from "@/server/inventory/stock";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ warehouseId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { warehouseId } = await context.params;
    return Response.json(await updateWarehouse(warehouseId, body), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid warehouse update.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to update warehouse.";
    return Response.json({ error: message }, { status: message.includes("access") ? 403 : message.includes("required") ? 404 : 400 });
  }
}
