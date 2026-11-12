import { Prisma, SellerPayoutMethodStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AuthenticationRequiredError, PermissionDeniedError, requirePlatformManagement } from "@/server/identity/permission-guard";
import { MfaEnrollmentRequiredError, MfaVerificationRequiredError, StepUpRequiredError } from "@/server/identity/access-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    await requirePlatformManagement();
    const url = new URL(request.url);
    const query = z.object({
      status: z.enum(["PENDING_VERIFICATION", "VERIFIED", "REJECTED"]).default("PENDING_VERIFICATION"),
      page: z.coerce.number().int().min(1).max(1000).default(1)
    }).strict().safeParse({
      status: url.searchParams.get("status") ?? undefined,
      page: url.searchParams.get("page") ?? undefined
    });
    if (!query.success) {
      return Response.json({ error: "Unsupported bank destination status." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const { status: requestedStatus, page } = query.data;
    const take = 50;
    const where = { status: requestedStatus as SellerPayoutMethodStatus };
    const [items, total] = await prisma.$transaction([
      prisma.sellerPayoutMethod.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * take,
        take,
        select: {
          id: true, sellerId: true, type: true, bankName: true, countryCode: true,
          currencyCode: true, accountLast4: true, status: true, isDefault: true,
          verifiedAt: true, createdAt: true,
          seller: {
            select: {
              displayName: true, legalName: true, contactName: true, contactEmail: true,
              owner: { select: { id: true, email: true, displayName: true } }
            }
          }
        }
      }),
      prisma.sellerPayoutMethod.count({ where })
    ]);
    return Response.json({ items, page, pageSize: take, total, pageCount: Math.max(1, Math.ceil(total / take)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) return Response.json({ error: "Complete the required MFA verification before reviewing bank destinations." }, { status: 428, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof PermissionDeniedError) return Response.json({ error: "Platform management permission required." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof Prisma.PrismaClientKnownRequestError) return Response.json({ error: "Unable to load bank destinations." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    return Response.json({ error: "Unable to load bank destinations." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
