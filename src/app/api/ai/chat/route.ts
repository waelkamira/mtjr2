import { z } from "zod";
import { validateIdentityMutationRequest } from "@/server/identity/request-security";
import { answerCustomer, assistantInputSchema } from "@/server/ai/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestWindows = new Map<string, { startedAt: number; count: number }>();
function isRateLimited(request: Request): boolean {
  const key = (request.headers.get("x-vercel-forwarded-for") ?? "local-shared").split(",")[0].trim();
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    if (requestWindows.size > 10000) requestWindows.clear();
    return false;
  }
  current.count += 1;
  return current.count > 12;
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
