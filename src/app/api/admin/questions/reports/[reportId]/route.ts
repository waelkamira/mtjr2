import { z } from "zod";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { moderateProductQaReport } from "@/server/catalog/product-qa-governance";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ reportId: string }> };
const schema = z.object({ decision: z.enum(["REVIEW", "DISMISS"]), reason: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { reportId } = await context.params;
    const data = schema.parse(await request.json());
    return Response.json({ report: await moderateProductQaReport(reportId, data.decision, data.reason) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid moderation action." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to moderate report." }, { status: 409 });
  }
}
