import { z } from "zod";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { getPlatformAuditEvents } from "@/server/admin/platform-audit";

export const runtime = "nodejs";

const querySchema = z.object({
  action: z.string().optional(),
  resource: z.string().optional(),
  actorId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.string().optional()
}).strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return Response.json({ error: "Invalid audit filters." }, { status: 400 });
    return Response.json(await getPlatformAuditEvents(parsed.data), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof MfaEnrollmentRequiredError) return Response.json({ error: "MFA enrollment is required.", code: "MFA_ENROLLMENT_REQUIRED" }, { status: 403 });
    if (error instanceof StepUpRequiredError) return Response.json({ error: "Recent MFA verification is required.", code: "STEP_UP_REQUIRED" }, { status: 428 });
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: "Permission denied." }, { status: 403 });
    }
    if (error instanceof z.ZodError || (error instanceof Error && /audit date range/.test(error.message))) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid audit filters." }, { status: 400 });
    }
    return Response.json({ error: "Unable to load platform audit events." }, { status: 500 });
  }
}
