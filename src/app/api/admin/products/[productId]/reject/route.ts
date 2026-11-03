import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { rejectProduct } from "@/server/catalog/products";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { productId } = await context.params;
    const parsed = z.object({ reason: z.string().trim().min(5).max(2000) }).strict().safeParse(body);
    if (!parsed.success) return Response.json({ error: "A rejection reason is required." }, { status: 400 });
    return Response.json(await rejectProduct({ productId, reason: parsed.data.reason }));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to reject product." }, { status: 400 });
  }
}
