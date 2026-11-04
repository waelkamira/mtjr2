import { z } from "zod";
import {
  AuthenticationRequiredError,
  PermissionDeniedError
} from "@/server/identity/permission-guard";
import { getAdminDashboard } from "@/server/admin/dashboard";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    return Response.json(await getAdminDashboard(params), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: "Permission denied." }, { status: 403 });
    }
    if (error instanceof z.ZodError || (error instanceof Error && /date|selected .* (available|found)|belong|range/i.test(error.message))) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid dashboard filters." }, { status: 400 });
    }
    return Response.json({ error: "Unable to load marketplace dashboard." }, { status: 500 });
  }
}
