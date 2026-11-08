import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/current-session";
import { createStoreShippingRate, listStoreShippingRates } from "@/server/shipping/shipping";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return Response.json({ error: "storeId is required." }, { status: 400 });
  try {
    return Response.json({ rates: await listStoreShippingRates(storeId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Shipping configuration access denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid store identifier." }, { status: 400 });
    return Response.json({ error: "Unable to load shipping configuration." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json(await createStoreShippingRate(body), { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Shipping configuration access denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid shipping rate.", issues: error.issues }, { status: 400 });
    if (error instanceof Error && error.message.includes("active market and currency")) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Unable to create shipping rate." }, { status: 500 });
  }
}
