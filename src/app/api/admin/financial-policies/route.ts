import { z } from "zod";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import {
  createFinancialPolicyVersion,
  listFinancialPolicyVersions
} from "@/server/admin/financial-policy-management";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

const querySchema = z.object({
  key: z.string().trim().max(120).optional(),
  domain: z.string().trim().max(64).optional(),
  approvalStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional()
}).strict();

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid financial policy input.", details: error.issues }, { status: 400 });
  if (error instanceof Error && /not found|not configured|does not belong|cannot be reused|requires|cannot review|cannot approve|cannot reject|only pending/i.test(error.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Unable to process financial policy." }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return failure(parsed.error);
    return Response.json(await listFinancialPolicyVersions(parsed.data), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    return Response.json({ version: await createFinancialPolicyVersion(body) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
