import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createStockCount, listStoreStockCounts } from "@/server/inventory/stock";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const storeId = new URL(request.url).searchParams.get("storeId") ?? "";
    return Response.json({ items: await listStoreStockCounts(storeId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "Unable to load stock counts.";
    return Response.json({ error: message }, { status: message.includes("access") ? 403 : 400 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json(await createStockCount(body), { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid stock count request.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to open stock count.";
    return Response.json({ error: message }, { status: message.includes("access") ? 403 : 400 });
  }
}
