import "server-only";

import { env } from "@/lib/env";

interface TurnstileResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
}

const LOCAL_TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyRegistrationChallenge(
  token: string,
  trustedIpAddress: string
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error("Turnstile is not configured.");
  }
  if (!token || token.length > 2048) return false;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: trustedIpAddress
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new Error(`Turnstile verification returned HTTP ${response.status}.`);
  }

  let result: TurnstileResponse;
  try {
    result = await response.json() as TurnstileResponse;
  } catch {
    throw new Error("Turnstile returned an invalid response.");
  }

  if (result.success !== true) return false;

  if (env.NODE_ENV === "development" && env.TURNSTILE_SECRET_KEY === LOCAL_TURNSTILE_TEST_SECRET) {
    return result.action === undefined && result.hostname === "example.com";
  }

  return result.action === "registration" &&
    result.hostname === new URL(env.APP_URL).hostname;
}
