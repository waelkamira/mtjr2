import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { publishProduct } from "@/server/catalog/products";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId } = await context.params;
    return Response.json(await publishProduct(productId));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to publish product." }, { status: 400 });
  }
}
