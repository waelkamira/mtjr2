import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { editSellerProductAnswer, listSellerAnswerHistory } from "@/server/catalog/product-qa-governance";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ answerId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { answerId } = await context.params;
    return Response.json(await listSellerAnswerHistory(answerId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ error: "Answer history is unavailable." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { answerId } = await context.params;
    return Response.json({ answer: await editSellerProductAnswer(answerId, await request.json()) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Answer must contain 3 to 4,000 characters." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to edit answer." }, { status: 403 });
  }
}
