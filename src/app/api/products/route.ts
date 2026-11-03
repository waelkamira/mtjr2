import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createDraftProduct } from "@/server/catalog/products";

export const runtime = "nodejs";
const bodySchema = z.object({
  name: z.string(), slug: z.string(), storeId: z.string()
}).passthrough();

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid product input." }, { status: 400 });
  try {
    const product = await createDraftProduct(body as Parameters<typeof createDraftProduct>[0]);
    return Response.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid product input.", issues: error.issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create product." }, { status: 400 });
  }
}
