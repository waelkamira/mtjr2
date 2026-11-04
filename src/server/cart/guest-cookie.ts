import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const GUEST_CART_COOKIE = "mtjr_cart_guest";
const GUEST_CART_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Creates an opaque guest identifier; only its SHA-256 hash is persisted. */
export async function getOrCreateGuestCartToken() {
  const store = await cookies();
  const existing = store.get(GUEST_CART_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{40,60}$/.test(existing)) return existing;

  const token = randomBytes(32).toString("base64url");
  store.set(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_TTL_SECONDS
  });
  return token;
}
