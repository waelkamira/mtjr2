import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { safeReturnPath } from "@/lib/safe-return-path";
import {
  isValidRegistrationChallengeCookie,
  REGISTRATION_CHALLENGE_COOKIE
} from "@/server/identity/registration-challenge";

export const runtime = "nodejs";
const COOKIE_OPTIONS = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const intentParam = url.searchParams.get("intent") ?? "register";
  if (intentParam !== "login" && intentParam !== "register") {
    return Response.json({ error: "Invalid Google authentication intent." }, { status: 400 });
  }
  const intent = intentParam;
  const accountType = intent === "login" ? "CUSTOMER" : url.searchParams.get("accountType") ?? "CUSTOMER";
  const acceptedTerms = url.searchParams.get("acceptedTerms") === "1";
  const acceptedPrivacy = url.searchParams.get("acceptedPrivacy") === "1";
  if (accountType !== "CUSTOMER" && accountType !== "SELLER") {
    return Response.json({ error: "Choose a valid account type." }, { status: 400 });
  }
  if (intent === "register" && (!acceptedTerms || !acceptedPrivacy)) {
    return Response.json({ error: "Choose an account type and accept both policy documents before continuing." }, { status: 400 });
  }
  const sellerLegalName = intent === "register" ? url.searchParams.get("sellerLegalName")?.trim() ?? "" : "";
  const sellerDisplayName = intent === "register" ? url.searchParams.get("sellerDisplayName")?.trim() ?? "" : "";
  if (accountType === "SELLER" &&
      (sellerLegalName.length < 2 || sellerLegalName.length > 160 || sellerDisplayName.length < 2 || sellerDisplayName.length > 80)) {
    return Response.json({ error: "Seller applicant and store names are required." }, { status: 400 });
  }

  const returnTo = safeReturnPath(url.searchParams.get("returnTo"), env.APP_URL, "/account/orders");
  function redirectToAuthError(code: string): Response {
    const page = intent === "login" ? "/login" : "/register";
    const destination = new URL(page, env.APP_URL);
    destination.searchParams.set("oauth", code);
    if (returnTo !== "/") destination.searchParams.set("returnTo", returnTo);
    return Response.redirect(destination, 303);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return redirectToAuthError("unavailable");
  }

  const store = await cookies();
  if (intent === "register" && !isValidRegistrationChallengeCookie(
    store.get(REGISTRATION_CHALLENGE_COOKIE)?.value
  )) {
    return redirectToAuthError("challenge_required");
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  store.set("mtjr_google_state", state, COOKIE_OPTIONS);
  store.set("mtjr_google_verifier", verifier, COOKIE_OPTIONS);
  store.set("mtjr_google_intent", intent, COOKIE_OPTIONS);
  store.set("mtjr_google_return_to", encodeURIComponent(returnTo), COOKIE_OPTIONS);
  store.set("mtjr_google_account_type", accountType, COOKIE_OPTIONS);
  store.set("mtjr_google_terms", intent === "register" ? "v1" : "", COOKIE_OPTIONS);
  store.set("mtjr_google_privacy", intent === "register" ? "v1" : "", COOKIE_OPTIONS);
  store.set("mtjr_google_seller_legal", encodeURIComponent(sellerLegalName), COOKIE_OPTIONS);
  store.set("mtjr_google_seller_display", encodeURIComponent(sellerDisplayName), COOKIE_OPTIONS);
  if (intent === "register") {
    store.set(REGISTRATION_CHALLENGE_COOKIE, "", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      expires: new Date(0),
      maxAge: 0
    });
  }

  const callback = new URL("/api/auth/google/callback", env.APP_URL).toString();

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");
  return Response.redirect(authorize, 302);
}
