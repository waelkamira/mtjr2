import { z } from "zod";
import { listAdminBrands, saveAdminBrand } from "@/server/admin/catalog-management";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof PermissionDeniedError) return Response.json({ error: "Permission denied." }, { status: 403 });
  if (error instanceof z.ZodError) return Response.json({ error: "Invalid brand request." }, { status: 400 });
  if (error instanceof Error && /not found|URL is not allowed/i.test(error.message)) return Response.json({ error: error.message }, { status: 409 });
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return Response.json({ error: "A brand with this slug already exists." }, { status: 409 });
  return Response.json({ error: "Unable to process brand request." }, { status: 500 });
}

export async function GET(): Promise<Response> {
  try { return Response.json({ items: await listAdminBrands() }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try { return Response.json({ item: await saveAdminBrand(body) }, { status: 201, headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}
