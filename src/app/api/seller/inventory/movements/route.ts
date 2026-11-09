import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listStoreInventoryMovements } from "@/server/inventory/stock";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const storeId = params.get("storeId");
  const limit = Number(params.get("limit") ?? "100");
  const cursor = params.get("cursor") ?? undefined;
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try {
    return Response.json(await listStoreInventoryMovements(storeId, new Date(), { limit, cursor }), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid inventory movement query." }, { status: 400 });
    return Response.json({ error: "Inventory access denied." }, { status: 403 });
  }
}
