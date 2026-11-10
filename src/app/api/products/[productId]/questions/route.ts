import { z } from "zod";
import { AuthenticationRequiredError } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { createProductQuestion, listPublicProductQuestions } from "@/server/catalog/product-qa";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ productId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { productId } = await context.params;
    return Response.json({ items: await listPublicProductQuestions(productId) }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch {
    return Response.json({ error: "Product questions are unavailable." }, { status: 404 });
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { productId } = await context.params;
    return Response.json({ question: await createProductQuestion(productId, await request.json()) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Sign in to ask a product question." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Question must contain 10 to 2,000 characters." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit question." }, { status: 400 });
  }
}
