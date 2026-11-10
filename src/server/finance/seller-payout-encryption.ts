import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

function keyRing() {
  const keys = new Map<number, Buffer>();
  if (env.PAYMENT_PROVIDER_ENCRYPTION_KEY) keys.set(1, Buffer.from(env.PAYMENT_PROVIDER_ENCRYPTION_KEY, "hex"));
  if (env.PAYMENT_PROVIDER_ENCRYPTION_KEYS) {
    const parsed = JSON.parse(env.PAYMENT_PROVIDER_ENCRYPTION_KEYS) as Record<string, string>;
    for (const [version, value] of Object.entries(parsed)) {
      if (!Number.isSafeInteger(Number(version)) || Number(version) < 1 || String(Number(version)) !== version || !/^[a-fA-F0-9]{64}$/.test(value)) {
        throw new Error("The payout encryption key ring is invalid.");
      }
      keys.set(Number(version), Buffer.from(value, "hex"));
    }
  }
  const version = env.PAYMENT_PROVIDER_ENCRYPTION_KEY_VERSION;
  const master = keys.get(version);
  if (!master) throw new Error("Seller bank-account encryption is not configured. Set the active payment encryption key ring.");
  // Derive independent keys for payout data and account fingerprints.
  const derive = (key: Buffer) => ({
    encryptionKey: createHmac("sha256", key).update("matjar:seller-payout:encryption:v1").digest(),
    fingerprintKey: createHmac("sha256", key).update("matjar:seller-payout:fingerprint:v1").digest()
  });
  return { version, active: derive(master), versions: new Map([...keys.entries()].map(([keyVersion, key]) => [keyVersion, derive(key)])) };
}

export function encryptSellerPayoutDetails(details: { accountIdentifier: string; routingCode?: string }) {
  const keys = keyRing();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.active.encryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return {
    keyVersion: keys.version,
    encryptedDetails: [`v${keys.version}`, nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
  };
}

export function fingerprintSellerPayoutAccount(countryCode: string, accountIdentifier: string) {
  const keys = keyRing();
  return createHmac("sha256", keys.active.fingerprintKey)
    .update(countryCode.toUpperCase())
    .update(":")
    .update(accountIdentifier.replace(/\s+/g, "").toUpperCase())
    .digest("hex");
}

export function decryptSellerPayoutDetails(envelope: string, version: number) {
  const keys = keyRing();
  const selected = keys.versions.get(version);
  if (!selected) throw new Error("The stored seller bank-account key version is unavailable. Restore that key before processing payouts.");
  const [tag, noncePart, authTagPart, ciphertextPart, extra] = envelope.split(".");
  if (tag !== `v${version}` || !noncePart || !authTagPart || !ciphertextPart || extra !== undefined) {
    throw new Error("The stored seller bank-account envelope is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", selected.encryptionKey, Buffer.from(noncePart, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64url")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Stored seller bank-account details are invalid.");
  return parsed as { accountIdentifier: string; routingCode?: string };
}
