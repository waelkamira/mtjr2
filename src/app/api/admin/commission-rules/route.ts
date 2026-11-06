import { z } from "zod";
import {
  createCommissionRule,
  listCommissionRules
} from "@/server/admin/commission-management";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

const createSchema = z.object({
  scope: z.enum(["GLOBAL", "SELLER", "CATEGORY", "SELLER_CATEGORY"]),
  sellerId: z.string().trim().min(1).max(128).optional(),
  categoryId: z.string().trim().min(1).max(128).optional(),
  rateBasisPoints: z.number().int().min(0).max(10_000),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().nullable().optional()
}).strict();

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid commission rule." }, { status: 400 });
  if (error instanceof Error && /already covers|must be after|does not match|not found/i.test(error.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Unable to process commission rule." }, { status: 500 });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listCommissionRules(), {
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
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return failure(parsed.error);
  try {
    const rule = await createCommissionRule({
      ...parsed.data,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      effectiveUntil: parsed.data.effectiveUntil ? new Date(parsed.data.effectiveUntil) : null
    });
    return Response.json({ rule }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
