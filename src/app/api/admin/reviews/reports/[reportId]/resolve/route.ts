import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { resolveReviewReport } from "@/server/reviews/product-reviews";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  try {
    const { reportId } = await context.params;
    const body = z.object({
      decision: z.enum(["DISMISS", "HIDE"]),
      reason: z.string().trim().min(3).max(500)
    }).strict().parse(await request.json());
    return Response.json({ report: await resolveReviewReport(reportId, body.decision, body.reason) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid report resolution." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to resolve report." }, { status: 409 });
  }
}
