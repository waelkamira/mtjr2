import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/server/identity/current-session";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({ displayName: z.string().trim().min(1).max(80) }).strict();

export async function GET(): Promise<Response> {
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, displayName: true, status: true, createdAt: true }
    });
    if (!user) return Response.json({ error: "Account not found." }, { status: 404 });
    const [orderStatuses, favorites, productReviews, storeReviews, monthlyOrders] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: { userId: session.userId }, _count: { _all: true } }),
      prisma.favorite.count({ where: { userId: session.userId } }),
      prisma.productReview.count({ where: { userId: session.userId } }),
      prisma.storeReview.count({ where: { userId: session.userId } }),
      prisma.$queryRaw<Array<{ month: string; count: number }>>`
        SELECT to_char(date_trunc('month', "placedAt"), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM "Order"
        WHERE "userId" = ${session.userId}
          AND "placedAt" >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY 1
        ORDER BY 1
      `
    ]);
    const totalOrders = orderStatuses.reduce((sum, row) => sum + row._count._all, 0);
    return Response.json({
      profile: { ...user, createdAt: user.createdAt.toISOString() },
      analytics: {
        totalOrders,
        orderStatuses: orderStatuses.map((row) => ({ status: row.status, count: row._count._all })),
        monthlyOrders: monthlyOrders.map((row) => ({ month: row.month, count: row.count })),
        favorites,
        productReviews,
        storeReviews
      }
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Enter a valid display name." }, { status: 400 });
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "Authentication required." }, { status: 401 });
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { displayName: parsed.data.displayName },
      select: { id: true, email: true, displayName: true, status: true }
    });
    return Response.json({ profile: user });
  } catch {
    return Response.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
