import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listSellerStoreProducts } from "@/server/catalog/products";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const storeId = params.get("storeId");
  const q = params.get("q") ?? undefined;
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try {
    return Response.json({ items: await listSellerStoreProducts(storeId, new Date(), { q }) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Store catalog access denied." }, { status: 403 });
  }
}
