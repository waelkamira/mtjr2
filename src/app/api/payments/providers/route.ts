import { listAvailablePaymentProviders } from "@/server/payments/payments";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const currencyCode = url.searchParams.get("currency")?.toUpperCase() ?? undefined;
  const countryCode = url.searchParams.get("country")?.toUpperCase() ?? undefined;
  if ((currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) || (countryCode && !/^[A-Z]{2}$/.test(countryCode))) {
    return Response.json({ error: "Invalid checkout market." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ providers: await listAvailablePaymentProviders({ currencyCode, countryCode }) }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
