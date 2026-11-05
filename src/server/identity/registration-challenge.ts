import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const REGISTRATION_CHALLENGE_COOKIE = "mtjr_registration_challenge";
export const REGISTRATION_CHALLENGE_TTL_SECONDS = 5 * 60;

function sign(payload: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`registration-challenge:${payload}`, "utf8")
    .digest("hex");
}

export function createRegistrationChallengeCookie(now = new Date()): string {
  const expiresAt = now.getTime() + REGISTRATION_CHALLENGE_TTL_SECONDS * 1000;
  const payload = `${expiresAt}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidRegistrationChallengeCookie(
  value: string | undefined,
  now = new Date()
): boolean {
  if (!value) return false;
  const [expiresAt, nonce, signature, extra] = value.split(".");
  if (!expiresAt || !nonce || !signature || extra !== undefined) return false;
  if (!/^\d+$/.test(expiresAt) || !/^[A-Za-z0-9_-]{22}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }
  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= now.getTime()) return false;

  const payload = `${expiresAt}.${nonce}`;
  const expected = Buffer.from(sign(payload), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
