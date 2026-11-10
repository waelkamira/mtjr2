import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { changeStoreStaffRole } from "@/server/marketplace/store-staff";

export const runtime = "nodejs";
const bodySchema = z.object({
  roleKey: z.enum(["STORE_MANAGER", "STORE_CATALOG_MANAGER", "STORE_INVENTORY_MANAGER", "STORE_ORDER_MANAGER", "STORE_CUSTOMER_CARE", "STORE_MARKETING_MANAGER"])
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ membershipId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid staff role." }, { status: 400 });
  try {
    const { membershipId } = await context.params;
    return Response.json(await changeStoreStaffRole(membershipId, parsed.data.roleKey));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to change staff role." }, { status: 403 });
  }
}
