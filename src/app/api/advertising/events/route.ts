import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { recordSponsoredAdEvent } from "@/server/advertising/delivery";\nimport { enforcePublicSearchBudget } from "@/server/search/search-request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid event." }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.token !== "string" || typeof value.eventId !== "string" || (value.type !== "IMPRESSION" && value.type !== "CLICK")) {
    return Response.json({ error: "Invalid advertising event." }, { status: 400 });
  }
  try {
    return Response.json(await recordSponsoredAdEvent({ token: value.token, eventId: value.eventId, type: value.type, headers: request.headers }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record advertising event.";
    return Response.json({ error: message }, { status: /invalid|expired/i.test(message) ? 400 : 409 });
  }
}
