import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createMarketTaxRate, listMarketTaxRates } from "@/server/tax/tax";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ rates: await listMarketTaxRates() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tax rules.";
    return Response.json({ error: message }, { status: /permission|administration/i.test(message) ? 403 : 400 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ rate: await createMarketTaxRate(body) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create tax rule.";
    return Response.json({ error: message }, { status: /permission|administration/i.test(message) ? 403 : 400 });
  }
}
