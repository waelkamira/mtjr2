import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { updateDraftProduct } from "@/server/catalog/products";
import { getDiscoverableProduct } from "@/server/catalog/discovery";
import { getPreferredLocale } from "@/server/locale";
import { isLocale } from "@/lib/locale";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const { productId } = await context.params;
    return Response.json(await updateDraftProduct(productId, body as Parameters<typeof updateDraftProduct>[1]));
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid product update.", issues: error.issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update product." }, { status: 400 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  try {
    const { productId } = await context.params;
    const requestedLocale = new URL(request.url).searchParams.get("locale");
    const locale = requestedLocale ?? await getPreferredLocale();
    if (!isLocale(locale)) return Response.json({ error: "Unsupported locale." }, { status: 400 });
    const product = await getDiscoverableProduct(productId, locale);
    return product ? Response.json(product) : Response.json({ error: "Product not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid product query." }, { status: 400 });
    return Response.json({ error: "Unable to load product." }, { status: 500 });
  }
}
