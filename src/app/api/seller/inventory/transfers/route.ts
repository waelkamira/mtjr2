import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { createStockTransfer, listStoreStockTransfers } from "@/server/inventory/stock";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try { return Response.json({ items: await listStoreStockTransfers(storeId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Inventory access denied." }, { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try { return Response.json(await createStockTransfer(body), { status: 201 }); }
  catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid stock transfer.", issues: error.issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create transfer." }, { status: 400 });
  }
}
