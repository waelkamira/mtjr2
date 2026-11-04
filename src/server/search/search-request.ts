import { env } from "@/lib/env";
import { consumeSearchAttempt } from "@/server/identity/login-throttle";
import { resolveTrustedClientIp } from "@/server/identity/trusted-client-ip";

export async function enforcePublicSearchBudget(request: Request): Promise<Response | null> {
  const ip = resolveTrustedClientIp(request.headers, env.TRUSTED_PROXY_IP_HEADER, env.NODE_ENV);
  if (!ip) return Response.json({ error: "Search service is not configured." }, { status: 503 });
  let result: { blocked: boolean };
  try {
    result = await consumeSearchAttempt(ip);
  } catch {
    return Response.json({ error: "Search service is temporarily unavailable." }, { status: 503 });
  }
  if (result.blocked) {
    return Response.json({ error: "Too many search requests. Please try again later." }, {
      status: 429,
      headers: { "Retry-After": "900" }
    });
  }
  return null;
}
