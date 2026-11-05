import { createPublicKey, verify as verifySignature } from "node:crypto";

const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

type GoogleJwk = {
  kid?: string;
  kty?: string;
  use?: string;
  alg?: string;
  key_ops?: string[];
  n?: string;
  e?: string;
};

type GoogleIdTokenPayload = Record<string, unknown>;

export type GoogleIdTokenClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  email: string;
  email_verified: true;
  exp: number;
  iat: number;
  nonce: string;
  azp?: string;
  nbf?: number;
  name?: string;
};

function decodeJsonPart<T>(part: string): T | null {
  try {
    const bytes = Buffer.from(part, "base64url");
    if (!bytes.length) return null;
    return JSON.parse(bytes.toString("utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Verify Google's signed ID token locally against Google's published RS256
 * signing keys. The tokeninfo endpoint is intended for debugging, not production
 * validation. The caller supplies the one-time nonce stored with the OAuth state.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  expectedNonce: string,
  now = Date.now(),
  fetcher: typeof fetch = fetch
): Promise<GoogleIdTokenClaims | null> {
  try {
    if (!idToken || idToken.length > 16_384 || !clientId || !expectedNonce) return null;

    const parts = idToken.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeJsonPart<{ alg?: string; kid?: string }>(encodedHeader);
    if (!header || header.alg !== "RS256" || !header.kid) return null;

    const keysResponse = await fetcher(GOOGLE_JWKS_URI, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!keysResponse.ok) return null;

    const keySet = await keysResponse.json() as { keys?: GoogleJwk[] };
    const jwk = Array.isArray(keySet.keys)
      ? keySet.keys.find((key) =>
          key.kid === header.kid &&
          key.kty === "RSA" &&
          (!key.use || key.use === "sig") &&
          (!key.alg || key.alg === "RS256") &&
          (!key.key_ops || key.key_ops.includes("verify")) &&
          typeof key.n === "string" &&
          typeof key.e === "string"
        )
      : undefined;
    if (!jwk) return null;

    const publicKey = createPublicKey({
      key: { kty: "RSA", n: jwk.n, e: jwk.e } as JsonWebKey,
      format: "jwk"
    });
    const signature = Buffer.from(encodedSignature, "base64url");
    if (!signature.length || !verifySignature(
      "RSA-SHA256",
      Buffer.from(encodedHeader + "." + encodedPayload, "utf8"),
      publicKey,
      signature
    )) {
      return null;
    }

    const claims = decodeJsonPart<GoogleIdTokenPayload>(encodedPayload);
    if (!claims) return null;

    const audience = claims.aud;
    const audienceMatches = typeof audience === "string"
      ? audience === clientId
      : Array.isArray(audience) && audience.every((value) => typeof value === "string") && audience.includes(clientId);
    if (!audienceMatches) return null;
    if (claims.azp !== undefined && claims.azp !== clientId) return null;
    if (Array.isArray(audience) && audience.length > 1 && claims.azp !== clientId) return null;

    if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) return null;
    if (typeof claims.email !== "string" || !claims.email.trim() || claims.email.length > 254) return null;
    if (claims.email_verified !== true) return null;
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now) return null;
    if (typeof claims.iat !== "number" || !Number.isFinite(claims.iat) || claims.iat * 1000 > now + 60_000) return null;
    if (claims.exp <= claims.iat) return null;
    if (claims.nbf !== undefined && (
      typeof claims.nbf !== "number" ||
      !Number.isFinite(claims.nbf) ||
      claims.nbf * 1000 > now + 60_000
    )) return null;
    if (claims.nonce !== expectedNonce) return null;

    return {
      iss: claims.iss as string,
      aud: audience as string | string[],
      sub: claims.sub,
      email: claims.email,
      email_verified: true,
      exp: claims.exp,
      iat: claims.iat,
      nonce: claims.nonce as string,
      ...(typeof claims.azp === "string" ? { azp: claims.azp } : {}),
      ...(typeof claims.nbf === "number" ? { nbf: claims.nbf } : {}),
      ...(typeof claims.name === "string" ? { name: claims.name } : {})
    };
  } catch {
    return null;
  }
}
