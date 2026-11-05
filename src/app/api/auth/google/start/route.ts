import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const runtime = "nodejs";
const COOKIE_OPTIONS = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };

export async function GET(request: Request): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.redirect(new URL("/register?oauth=unavailable", env.NEXT_PUBLIC_APP_URL), 303);
  }
  const url = new URL(request.url);
  const accountType = url.searchParams.get("accountType");
  const acceptedTerms = url.searchParams.get("acceptedTerms") === "1";
  const acceptedPrivacy = url.searchParams.get("acceptedPrivacy") === "1";
  if ((accountType !== "CUSTOMER" && accountType !== "SELLER") || !acceptedTerms || !acceptedPrivacy) {
    return Response.json({ error: "Choose an account type and accept both policy documents before continuing." }, { status: 400 });
  }
  const sellerLegalName = url.searchParams.get("sellerLegalName")?.trim() ?? "";
  const sellerDisplayName = url.searchParams.get("sellerDisplayName")?.trim() ?? "";
  if (accountType === "SELLER" && (sellerLegalName.length < 2 || sellerLegalName.length > 160 || sellerDisplayName.length < 2 || sellerDisplayName.length > 80)) {
    return Response.json({ error: "Seller applicant and store names are required." }, { status: 400 });
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const store = await cookies();
  store.set("mtjr_google_state", state, COOKIE_OPTIONS);
  store.set("mtjr_google_verifier", verifier, COOKIE_OPTIONS);
  store.set("mtjr_google_nonce", nonce, COOKIE_OPTIONS);
  store.set("mtjr_google_account_type", accountType, COOKIE_OPTIONS);
  store.set("mtjr_google_terms", "v1", COOKIE_OPTIONS);
  store.set("mtjr_google_privacy", "v1", COOKIE_OPTIONS);
  store.set("mtjr_google_seller_legal", encodeURIComponent(sellerLegalName), COOKIE_OPTIONS);
  store.set("mtjr_google_seller_display", encodeURIComponent(sellerDisplayName), COOKIE_OPTIONS);

  const callback = new URL("/api/auth/google/callback", env.NEXT_PUBLIC_APP_URL).toString();
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("prompt", "select_account");
  return Response.redirect(authorize, 302);
}
