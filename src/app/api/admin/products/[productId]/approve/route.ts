import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { approveProduct } from "@/server/catalog/products";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId } = await context.params;
    return Response.json(await approveProduct(productId));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to approve product." }, { status: 400 });
  }
}
