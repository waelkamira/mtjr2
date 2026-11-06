import { z } from "zod";
import {
  archiveAdminProducts,
  listAdminCatalogProducts
} from "@/server/admin/catalog-management";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof PermissionDeniedError) {
    return Response.json({ error: "Permission denied." }, { status: 403 });
  }
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Invalid product management request." }, { status: 400 });
  }
  if (error instanceof Error && /not found|at most 500|Narrow the selection/i.test(error.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return Response.json({ error: "Unable to process product management request." }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  try {
    return Response.json(await listAdminCatalogProducts({
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || undefined,
      storeId: searchParams.get("storeId") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined
    }), { headers: { "Cache-Control": "private, no-store" } });
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
  try {
    return Response.json(await archiveAdminProducts(body), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return failure(error);
  }
}
