import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { moderateProductQa } from "@/server/catalog/product-qa";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ itemId: string }> };
const schema = z.object({ type: z.enum(["QUESTION", "ANSWER"]), decision: z.enum(["PUBLISH", "REJECT", "HIDE"]), reason: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { itemId } = await context.params;
    const body = schema.parse(await request.json());
    return Response.json({ item: await moderateProductQa(body.type, itemId, body.decision, body.reason) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid moderation action." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to moderate product Q&A." }, { status: 409 });
  }
}
