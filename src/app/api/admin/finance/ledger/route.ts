import { z } from "zod";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  requirePlatformManagement
} from "@/server/identity/permission-guard";
import {
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError,
  StepUpRequiredError
} from "@/server/identity/access-errors";
import {
  listLedgerAccountEntries,
  listLedgerAccounts
} from "@/server/finance/ledger";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  currencyCode: z.string().trim().length(3).optional(),
  accountType: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).optional(),
  active: z.enum(["true", "false", "all"]).default("all"),
  accountId: z.string().trim().min(1).max(128).optional(),
  cursor: z.string().trim().min(1).max(128).optional(),
  activityCursor: z.string().trim().min(1).max(128).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50)
}).strict();

export async function GET(request: Request): Promise<Response> {
  try {
    await requirePlatformManagement();
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) {
      return Response.json({ error: "Invalid ledger filters.", details: parsed.error.issues }, { status: 400 });
    }
    const filters = parsed.data;
    const accounts = await listLedgerAccounts({
      query: filters.q,
      currencyCode: filters.currencyCode,
      accountType: filters.accountType,
      isActive: filters.active === "all" ? undefined : filters.active === "true",
      take: filters.take,
      cursor: filters.cursor
    });
    const activity = filters.accountId
      ? await listLedgerAccountEntries({ accountId: filters.accountId, take: filters.take, cursor: filters.activityCursor })
      : null;
    return Response.json({ accounts, activity }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof PermissionDeniedError) {
      return Response.json({ error: "Permission denied." }, { status: 403 });
    }
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError || error instanceof StepUpRequiredError) {
      return Response.json({ error: "Complete the required MFA verification to access the accounting ledger." }, { status: 428 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid ledger filters." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Ledger account not found.") {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ error: "Unable to load the accounting ledger." }, { status: 500 });
  }
}
