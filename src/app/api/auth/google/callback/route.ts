import { cookies } from "next/headers";
import { AuditActorType, ConsentType, SellerStatus, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env, isPublicRegistrationEnabled } from "@/lib/env";

import { createUserSession } from "@/server/identity/session";
import { setSessionCookie } from "@/server/identity/session-cookie";

export const runtime = "nodejs";

function redirectTo(path: string): Response {
  return Response.redirect(new URL(path, env.APP_URL), 303);

}

function clearOAuthCookies(store: Awaited<ReturnType<typeof cookies>>) {
  for (const name of ["mtjr_google_state","mtjr_google_verifier","mtjr_google_intent","mtjr_google_return_to","mtjr_google_account_type","mtjr_google_terms","mtjr_google_privacy","mtjr_google_seller_legal","mtjr_google_seller_display"]) {
    store.set(name, "", { path: "/api/auth/google", maxAge: 0, expires: new Date(0), httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" });
  }
}

function decodeCookieValue(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function safeReturnPath(value: string | undefined): string {
  const fallback = "/account/orders";
  const candidate = decodeCookieValue(value);
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  try {
    const parsed = new URL(candidate, env.APP_URL);
    return parsed.origin === new URL(env.APP_URL).origin
      ? parsed.pathname + parsed.search + parsed.hash
      : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request): Promise<Response> {
  const store = await cookies();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = store.get("mtjr_google_state")?.value;
  const verifier = store.get("mtjr_google_verifier")?.value;
  const intent = store.get("mtjr_google_intent")?.value ?? "register";
  const returnTo = safeReturnPath(store.get("mtjr_google_return_to")?.value);
  const accountType = store.get("mtjr_google_account_type")?.value;
  const termsVersion = store.get("mtjr_google_terms")?.value;
  const privacyVersion = store.get("mtjr_google_privacy")?.value;
  const sellerLegalName = decodeCookieValue(store.get("mtjr_google_seller_legal")?.value);
  const sellerDisplayName = decodeCookieValue(store.get("mtjr_google_seller_display")?.value);

  clearOAuthCookies(store);

  const page = intent === "login" ? "/login" : "/register";
  if (!code || !state || !expectedState || state !== expectedState || !verifier ||
      (intent !== "login" && intent !== "register") ||
      (accountType !== "CUSTOMER" && accountType !== "SELLER") ||
      (intent === "register" && (termsVersion !== "v1" || privacyVersion !== "v1"))) {
    return redirectTo(`${page}?oauth=invalid`);
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirectTo(`${page}?oauth=unavailable`);

  try {
    const callback = new URL("/api/auth/google/callback", env.APP_URL).toString();

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callback, grant_type: "authorization_code", code_verifier: verifier
      }),
      cache: "no-store"
    });
    if (!tokenResponse.ok) return redirectTo(`${page}?oauth=failed`);
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) return redirectTo(`${page}?oauth=failed`);

    const identityResponse = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(tokens.id_token), { cache: "no-store" });
    if (!identityResponse.ok) return redirectTo(`${page}?oauth=failed`);
    const identity = await identityResponse.json() as { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: string; name?: string; exp?: string };
    if ((identity.iss !== "https://accounts.google.com" && identity.iss !== "accounts.google.com") ||
        identity.aud !== env.GOOGLE_CLIENT_ID || !identity.sub || !identity.email ||
        identity.email_verified !== "true" || !identity.exp || Number(identity.exp) * 1000 <= Date.now()) {
      return redirectTo(`${page}?oauth=failed`);
    }
    const email = identity.email.trim().toLowerCase();
    const now = new Date();
    const linked = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: identity.sub } },
      select: { userId: true, user: { select: { id: true, status: true, emailVerifiedAt: true } } }
    });
    let userId: string;
    if (intent === "login") {
      // Login intent must never create or silently link an account. Only a
      // previously linked Google identity may establish a session.
      if (!linked) return redirectTo("/login?oauth=not_linked");
      if (linked.user.status !== UserStatus.ACTIVE || !linked.user.emailVerifiedAt) {
        return redirectTo("/login?oauth=inactive");
      }
      userId = linked.userId;
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { lastLoginAt: now } }),
        prisma.auditLog.create({
          data: {
            actorType: AuditActorType.USER,
            actorId: userId,
            action: "identity.login.succeeded",
            resource: "user",
            resourceId: userId,
            occurredAt: now,
            metadata: { method: "google" }
          }
        })
      ]);
    } else if (linked) {
      if (linked.user.status !== UserStatus.ACTIVE || !linked.user.emailVerifiedAt) return redirectTo("/login?oauth=inactive");
      userId = linked.userId;
    } else {
      const existing = await prisma.user.findUnique({ where: { emailNormalized: email }, select: { id: true } });
      if (existing) return redirectTo("/register?oauth=link_required");
      if (!isPublicRegistrationEnabled(env)) {
        return redirectTo("/register?oauth=registration_unavailable");
      }

      const created = await prisma.$transaction(async tx => {
        const user = await tx.user.create({
          data: { email, emailNormalized: email, displayName: identity.name?.slice(0,80) ?? null, passwordHash: null, status: UserStatus.ACTIVE, emailVerifiedAt: now },
          select: { id: true }
        });
        await tx.oAuthAccount.create({ data: { userId: user.id, provider: "google", providerAccountId: identity.sub! } });
        await tx.userConsent.createMany({ data: [
          { userId: user.id, type: ConsentType.TERMS_OF_SERVICE, version: termsVersion, granted: true, capturedAt: now, source: "google-registration" },
          { userId: user.id, type: ConsentType.PRIVACY_POLICY, version: privacyVersion, granted: true, capturedAt: now, source: "google-registration" }
        ]});
        if (accountType === "SELLER") {
          if (sellerLegalName.length < 2 || sellerDisplayName.length < 2) throw new Error("Seller application details missing.");
          await tx.seller.create({ data: { ownerId: user.id, legalName: sellerLegalName, displayName: sellerDisplayName, status: SellerStatus.PENDING } });
        }
        await tx.auditLog.create({ data: { actorType: AuditActorType.SYSTEM, action: "identity.registration.created", resource: "user", resourceId: user.id, occurredAt: now, metadata: { provider: "google", accountType } } });
        return user;
      });
      userId = created.id;
    }
    if (linked && intent === "register") {
      await prisma.$transaction(async (tx) => {
        const [terms, privacy, seller] = await Promise.all([
          tx.userConsent.findFirst({ where: { userId, type: ConsentType.TERMS_OF_SERVICE, version: termsVersion!, granted: true }, select: { id: true } }),
          tx.userConsent.findFirst({ where: { userId, type: ConsentType.PRIVACY_POLICY, version: privacyVersion!, granted: true }, select: { id: true } }),
          tx.seller.findUnique({ where: { ownerId: userId }, select: { id: true } })
        ]);
        const missing: Array<{ userId: string; type: ConsentType; version: string; granted: boolean; capturedAt: Date; source: string }> = [];
        if (!terms) missing.push({ userId, type: ConsentType.TERMS_OF_SERVICE, version: termsVersion!, granted: true, capturedAt: now, source: "google-registration" });
        if (!privacy) missing.push({ userId, type: ConsentType.PRIVACY_POLICY, version: privacyVersion!, granted: true, capturedAt: now, source: "google-registration" });
        if (missing.length) await tx.userConsent.createMany({ data: missing });
        if (accountType === "SELLER" && !seller) {
          if (sellerLegalName.length < 2 || sellerDisplayName.length < 2) throw new Error("Seller application details missing.");
          await tx.seller.create({ data: { ownerId: userId, legalName: sellerLegalName, displayName: sellerDisplayName, status: SellerStatus.PENDING } });
        }
        await tx.auditLog.create({ data: { actorType: AuditActorType.USER, actorId: userId, action: "identity.login.succeeded", resource: "user", resourceId: userId, occurredAt: now, metadata: { method: "google" } } });
      });
    }
    const session = await createUserSession(userId, { userAgent: request.headers.get("user-agent") }, now);
    await setSessionCookie(session.token, session.expiresAt);
    return redirectTo(intent === "login" ? returnTo : accountType === "SELLER" ? "/seller" : "/account");
  } catch {
    return redirectTo(`${page}?oauth=failed`);
  }
}
