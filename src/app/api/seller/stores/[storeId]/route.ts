import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { PermissionDeniedError } from "@/server/identity/permission-guard";
import { SellerStoreSettingsConflictError, updateSellerStoreSettings } from "@/server/marketplace/seller-store-settings";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ storeId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { storeId } = await context.params;
    return Response.json(await updateSellerStoreSettings(storeId, await request.json()), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof SellerStoreSettingsConflictError) {
      const message = error.code === "STORE_NOT_FOUND" ? "Store not found."
        : error.code === "SLUG_TAKEN" ? "This store URL is already in use."
        : "Store settings cannot be changed while the seller or store is inactive.";
      return Response.json({ error: message, code: error.code }, { status: error.code === "STORE_NOT_FOUND" ? 404 : 409 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid store settings." }, { status: 400 });
    return Response.json({ error: "Unable to update store settings." }, { status: 500 });
  }
}
