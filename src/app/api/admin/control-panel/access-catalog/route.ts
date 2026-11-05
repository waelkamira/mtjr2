import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { getPlatformAccessCatalog } from "@/server/admin/platform-access-catalog";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await getPlatformAccessCatalog(), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: "Permission denied." }, { status: 403 });
    }
    return Response.json({ error: "Unable to load the platform access catalogue." }, { status: 500 });
  }
}
