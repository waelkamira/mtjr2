import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createSellerProductAnswerWithStaff } from "@/server/catalog/product-qa-governance";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ questionId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { questionId } = await context.params;
    return Response.json({ answer: await createSellerProductAnswerWithStaff(questionId, await request.json()) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to answer product questions." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Answer must contain 3 to 4,000 characters." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit answer." }, { status: 403 });
  }
}
