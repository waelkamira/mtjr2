import { z } from "zod";
import { changeAdminUserStatus, getAdminUser } from "@/server/admin/users";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ userId: string }> };

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof PermissionDeniedError) {
    return Response.json({ error: "Permission denied." }, { status: 403 });
  }
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Invalid user administration request." }, { status: 400 });
  }
  if (error instanceof Error && error.message === "User was not found.") {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error && /cannot|already|concurrently|super administrator/i.test(error.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Unable to process user administration request." }, { status: 500 });
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { userId } = await context.params;
    return Response.json({ user: await getAdminUser(userId) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const { userId } = await context.params;
    return Response.json({ result: await changeAdminUserStatus(userId, body) }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return failure(error);
  }
}
