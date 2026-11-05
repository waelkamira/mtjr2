import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { safeReturnPath } from "@/lib/safe-return-path";

export const runtime = "nodejs";
const COOKIE_OPTIONS = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth/google", maxAge: 600 };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const intentParam = url.searchParams.get("intent") ?? "register";
  if (intentParam !== "login" && intentParam !== "register") {
    return Response.json({ error: "Invalid Google authentication intent." }, { status: 400 });
  }
  const intent = intentParam;
  const accountType = url.searchParams.get("accountType") ?? "CUSTOMER";
  const acceptedTerms = url.searchParams.get("acceptedTerms") === "1";
  const acceptedPrivacy = url.searchParams.get("acceptedPrivacy") === "1";
  if (accountType !== "CUSTOMER" && accountType !== "SELLER") {
    return Response.json({ error: "Choose a valid account type." }, { status: 400 });
  }
  if (intent === "register" && (!acceptedTerms || !acceptedPrivacy)) {
    return Response.json({ error: "Choose an account type and accept both policy documents before continuing." }, { status: 400 });
  }
  const sellerLegalName = url.searchParams.get("sellerLegalName")?.trim() ?? "";
  const sellerDisplayName = url.searchParams.get("sellerDisplayName")?.trim() ?? "";
  if (intent === "register" && accountType === "SELLER" &&
      (sellerLegalName.length < 2 || sellerLegalName.length > 160 || sellerDisplayName.length < 2 || sellerDisplayName.length > 80)) {
    return Response.json({ error: "Seller applicant and store names are required." }, { status: 400 });
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    const destination = intent === "login" ? "/login?oauth=unavailable" : "/register?oauth=unavailable";
    return Response.redirect(new URL(destination, env.APP_URL), 303);
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const store = await cookies();
  store.set("mtjr_google_state", state, COOKIE_OPTIONS);
  store.set("mtjr_google_verifier", verifier, COOKIE_OPTIONS);
  store.set("mtjr_google_intent", intent, COOKIE_OPTIONS);
  store.set("mtjr_google_account_type", accountType, COOKIE_OPTIONS);
  store.set("mtjr_google_terms", intent === "register" ? "v1" : "", COOKIE_OPTIONS);
  store.set("mtjr_google_privacy", intent === "register" ? "v1" : "", COOKIE_OPTIONS);
  store.set("mtjr_google_seller_legal", encodeURIComponent(sellerLegalName), COOKIE_OPTIONS);
  store.set("mtjr_google_seller_display", encodeURIComponent(sellerDisplayName), COOKIE_OPTIONS);
  store.set("mtjr_google_return_to", encodeURIComponent(safeReturnPath(url.searchParams.get("returnTo"), env.APP_URL)), COOKIE_OPTIONS);

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
