import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listStoreStockTransfers } from "@/server/inventory/stock";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try {
    return Response.json({ items: await listStoreStockTransfers(storeId) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Inventory access denied." }, { status: 403 });
  }
}
