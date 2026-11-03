import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import {
  assignRoleToUser,
  revokeRoleAssignment
} from "@/server/identity/role-assignment";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";

export const runtime = "nodejs";

const assignSchema = z.object({
  roleKey: z.string().trim().min(1).max(64),
  scope: z.object({
    type: z.string().trim().min(1).max(64),
    id: z.string().trim().min(1).max(256)
  }).optional(),
  expiresAt: z.string().datetime().optional()
}).strict();

const revokeSchema = z.object({
  assignmentId: z.string().trim().min(1).max(128)
}).strict();

function errorResponse(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof PermissionDeniedError) {
    return Response.json({ error: "Permission denied." }, { status: 403 });
  }
  return Response.json({ error: "Unable to update role assignments." }, { status: 400 });
}

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid role assignment." }, { status: 400 });

  try {
    const { userId } = await context.params;
    const result = await assignRoleToUser({
      targetUserId: userId,
      roleKey: parsed.data.roleKey,
      scope: parsed.data.scope,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid role assignment." }, { status: 400 });

  try {
    const revoked = await revokeRoleAssignment(parsed.data.assignmentId);
    return revoked
      ? Response.json({ revoked: true })
      : Response.json({ error: "Role assignment not found." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}
