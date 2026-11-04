import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { reportProductQuestion } from "@/server/catalog/product-qa-governance";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ questionId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { questionId } = await context.params;
    return Response.json({ report: await reportProductQuestion(questionId, await request.json()) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to report content." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid report details." }, { status: 400 });
    if (error instanceof Error && /Unique constraint/.test(error.message)) return Response.json({ error: "You have already reported this question." }, { status: 409 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit report." }, { status: 400 });
  }
}
