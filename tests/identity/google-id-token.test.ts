import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGoogleIdToken } from "@/server/identity/google-id-token";

const CLIENT_ID = "mtjr2-test-client.apps.googleusercontent.com";
const NONCE = "one-time-oauth-nonce";
const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const exportedJwk = keyPair.publicKey.export({ format: "jwk" });
const jwks = [{
  ...exportedJwk,
  kid: "test-google-key",
  kty: "RSA",
  use: "sig",
  alg: "RS256"
}];

function makeToken(
  overrides: Record<string, unknown> = {},
  signingKey = keyPair.privateKey,
  algorithm = "RS256"
): string {
  const header = Buffer.from(JSON.stringify({
    alg: algorithm,
    kid: "test-google-key",
    typ: "JWT"
  })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-subject-123",
    email: "buyer@example.test",
    email_verified: true,
    exp: Math.floor(NOW / 1000) + 600,
    iat: Math.floor(NOW / 1000),
    nonce: NONCE,
    name: "Test Buyer",
    ...overrides
  })).toString("base64url");
  const signingInput = header + "." + payload;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), signingKey).toString("base64url");
  return signingInput + "." + signature;
}

function jwksFetcher(keys: unknown[] = jwks, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify({ keys }), {
    status,
    headers: { "Content-Type": "application/json" }
  })) as typeof fetch;
}

describe("Google ID token verification", () => {
  it("accepts a valid Google RS256 token with the expected audience and one-time nonce", async () => {
    const claims = await verifyGoogleIdToken(makeToken(), CLIENT_ID, NONCE, NOW, jwksFetcher());
    expect(claims).toMatchObject({
      sub: "google-subject-123",
      email: "buyer@example.test",
      email_verified: true,
      nonce: NONCE
    });
  });

  it("rejects an ID token with a different audience", async () => {
    const token = makeToken({ aud: "another-client.apps.googleusercontent.com" });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
  });

  it("rejects an expired ID token", async () => {
    const token = makeToken({ exp: Math.floor(NOW / 1000) - 1 });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
  });

  it("rejects an unverified email and a mismatched nonce", async () => {
    const unverified = makeToken({ email_verified: false });
    const wrongNonce = makeToken({ nonce: "different-nonce" });
    await expect(verifyGoogleIdToken(unverified, CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
    await expect(verifyGoogleIdToken(wrongNonce, CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
  });

  it("rejects an invalid signature even when the token header names a known key", async () => {
    const otherKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = makeToken({}, otherKeyPair.privateKey);
    await expect(verifyGoogleIdToken(token, CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
  });

  it("rejects unsupported algorithms and unavailable signing keys", async () => {
    const unsupportedAlgorithm = makeToken({}, keyPair.privateKey, "HS256");
    await expect(verifyGoogleIdToken(unsupportedAlgorithm, CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
    await expect(verifyGoogleIdToken(makeToken(), CLIENT_ID, NONCE, NOW, jwksFetcher([], 503))).resolves.toBeNull();
  });

  it("rejects malformed tokens without throwing", async () => {
    await expect(verifyGoogleIdToken("not-a-jwt", CLIENT_ID, NONCE, NOW, jwksFetcher())).resolves.toBeNull();
  });
});
