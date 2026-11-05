import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import {
  createPlatformPrivilegeRequest,
  listPlatformPrivilegeRequests,
  PlatformPrivilegeRequestConflictError
} from "@/server/admin/platform-privilege-requests";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ requests: await listPlatformPrivilegeRequests() }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    return Response.json({ error: "Unable to load privilege requests." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;

  try {
    const body: unknown = await request.json();
    const created = await createPlatformPrivilegeRequest(body);
    return Response.json(created, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
    if (error instanceof PlatformPrivilegeRequestConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid privilege request." }, { status: 400 });
    return Response.json({ error: "Unable to create privilege request." }, { status: 500 });
  }
}
