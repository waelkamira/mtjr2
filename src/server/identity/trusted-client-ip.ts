import { isIP } from "node:net";

export type TrustedProxyIpHeader =
  | "cf-connecting-ip"
  | "x-vercel-forwarded-for";

/**
 * Resolve a client IP only from a deployment proxy header explicitly selected
 * by the operator. The edge proxy MUST overwrite this header and direct origin
 * access MUST be blocked; never configure this to trust arbitrary X-Forwarded-For.
 */
export function resolveTrustedClientIp(
  headers: Headers,
  trustedHeader: TrustedProxyIpHeader | undefined,
  nodeEnv: "development" | "test" | "production" = "production"
): string | null {
  if (!trustedHeader) {
    return nodeEnv === "development" ? "127.0.0.1" : null;
  }

  const rawValue = headers.get(trustedHeader);
  if (!rawValue) return null;

  // Vercel's trusted header can contain a comma-separated proxy chain; the
  // first entry is the original client. Cloudflare's header must be singular.
  const candidate =
    trustedHeader === "x-vercel-forwarded-for"
      ? rawValue.split(",")[0]?.trim()
      : rawValue.trim();

  if (!candidate || candidate.includes(",") || isIP(candidate) === 0) {
    return null;
  }

  return candidate;
}
