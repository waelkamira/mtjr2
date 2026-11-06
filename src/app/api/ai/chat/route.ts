import { z } from "zod";
import { env } from "@/lib/env";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { answerCustomer, assistantInputSchema } from "@/server/ai/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestWindows = new Map<string, { startedAt: number; count: number }>();

/** Apply a bounded per-client throttle using only the explicitly trusted proxy header. */
function isRateLimited(request: Request): boolean {
  const trustedHeader = env.TRUSTED_PROXY_IP_HEADER;
  const forwardedValue = trustedHeader ? request.headers.get(trustedHeader) : null;
  const clientKey = forwardedValue?.split(",")[0]?.trim();
  // Without a configured/available trusted client identity, use one restrictive
  // shared bucket rather than trusting arbitrary forwarding headers.
  const key = clientKey || "untrusted-client";
  const limit = clientKey ? 12 : 3;
  const now = Date.now();

  for (const [entryKey, entry] of requestWindows) {
    if (now - entry.startedAt >= 60_000) requestWindows.delete(entryKey);
  }

  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

export async function POST(request: Request): Promise<Response> {
  const rejected = validateIdentityMutationRequest(request);
  if (rejected) return rejected;
  if (isRateLimited(request)) {
    return Response.json({ error: "طلبات كثيرة خلال وقت قصير. حاول بعد دقيقة." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = assistantInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Message is invalid or too long." }, { status: 400 });
  }

  try {
    const result = await answerCustomer(parsed.data);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "AI_ASSISTANT_DISABLED") {
      return Response.json({ error: "المساعد الذكي غير متاح حالياً." }, { status: 503 });
    }
    if (code === "AI_RATE_LIMITED") {
      return Response.json({ error: "وصل المساعد إلى حد الاستخدام المجاني مؤقتاً. حاول لاحقاً." }, { status: 429 });
    }
    if (code === "AI_PROVIDER_AUTH_ERROR") {
      return Response.json({ error: "إعداد اتصال المساعد يحتاج إلى مراجعة المسؤول." }, { status: 503 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "تعذر فهم طلب البحث." }, { status: 400 });
    }
    return Response.json({ error: "حدث خطأ مؤقت. حاول مرة أخرى لاحقاً." }, { status: 502 });
  }
}
