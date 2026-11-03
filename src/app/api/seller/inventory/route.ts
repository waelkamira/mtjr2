import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { listStoreInventory } from "@/server/inventory/stock";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try { return Response.json(await listStoreInventory(storeId)); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid inventory query." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load inventory." }, { status: 403 });
  }
}
