import { z } from "zod";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/current-session";
import { getSellerDashboardAnalytics } from "@/server/marketplace/seller-analytics";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  storeId: z.string().trim().min(1).max(128),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).strict();

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    storeId: params.get("storeId") ?? "",
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined
  });
  if (!parsed.success) {
    return Response.json({ error: "A valid store and date range are required." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const analytics = await getSellerDashboardAnalytics(parsed.data);
    return Response.json(analytics, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: "You do not have permission to view this store's analytics." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const message = error instanceof Error ? error.message : "Seller analytics are unavailable.";
    const status = /date|range|90 days/i.test(message) ? 400 : 500;
    return Response.json({ error: status === 400 ? message : "Seller analytics are temporarily unavailable." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
