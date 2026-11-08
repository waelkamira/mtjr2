import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyGoogleIdToken } from "@/server/identity/google-id-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const now = Date.now();

function createToken(overrides: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: "google-client",
    sub: "google-user-123",
    email: "buyer@example.test",
    email_verified: true,
    exp: Math.floor(now / 1000) + 300,
    iat: Math.floor(now / 1000),
    nonce: "expected-nonce",
    ...overrides
  })).toString("base64url");
  const signingInput = header + "." + payload;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return signingInput + "." + signature;
}

function keyFetcher() {
  return vi.fn(async () => new Response(JSON.stringify({
    keys: [{ ...jwk, kid: "test-key", use: "sig", alg: "RS256", key_ops: ["verify"] }]
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
}

describe("Google ID token verification", () => {
  it("accepts a correctly signed token with the expected issuer, audience, email and nonce", async () => {
    const claims = await verifyGoogleIdToken(createToken(), "google-client", "expected-nonce", now, keyFetcher());
    expect(claims).toMatchObject({
      sub: "google-user-123",
      email: "buyer@example.test",
      email_verified: true,
      nonce: "expected-nonce"
    });
  });

  it("rejects a token with a different nonce or audience", async () => {
    await expect(verifyGoogleIdToken(createToken({ nonce: "other" }), "google-client", "expected-nonce", now, keyFetcher())).resolves.toBeNull();
    await expect(verifyGoogleIdToken(createToken({ aud: "other-client" }), "google-client", "expected-nonce", now, keyFetcher())).resolves.toBeNull();
  });

  it("rejects expired, unverified-email and tampered tokens", async () => {
    await expect(verifyGoogleIdToken(createToken({ exp: Math.floor(now / 1000) - 1 }), "google-client", "expected-nonce", now, keyFetcher())).resolves.toBeNull();
    await expect(verifyGoogleIdToken(createToken({ email_verified: false }), "google-client", "expected-nonce", now, keyFetcher())).resolves.toBeNull();
    const valid = createToken();
    const tokenParts = valid.split(".");
    tokenParts[2] = (tokenParts[2][0] === "A" ? "B" : "A") + tokenParts[2].slice(1);
    const tampered = tokenParts.join(".");
    await expect(verifyGoogleIdToken(tampered, "google-client", "expected-nonce", now, keyFetcher())).resolves.toBeNull();
  });

  it("rejects malformed tokens without requesting Google's key set", async () => {
    const fetcher = keyFetcher();
    await expect(verifyGoogleIdToken("not-a-jwt", "google-client", "expected-nonce", now, fetcher)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
