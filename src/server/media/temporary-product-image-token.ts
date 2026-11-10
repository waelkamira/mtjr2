import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type TemporaryProductImagePayload = {
  storeId: string;
  storageKey: string;
  expiresAt: number;
};

function signature(body: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(body, "utf8").digest("base64url");
}

/** A short-lived, store-bound capability for deleting an upload not yet attached to a product. */
export function createTemporaryProductImageDeleteToken(
  storeId: string,
  storageKey: string,
  now = Date.now()
): string {
  if (!storeId.trim() || !/^(imgur|imagekit|cloudinary):.+$/.test(storageKey)) {
    throw new Error("A valid store and provider storage key are required.");
  }
  const payload: TemporaryProductImagePayload = { storeId, storageKey, expiresAt: now + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return body + "." + signature(body);
}

export function verifyTemporaryProductImageDeleteToken(
  token: string,
  expectedStoreId: string,
  now = Date.now()
): string | null {
  if (!token || token.length > 2048 || !expectedStoreId.trim()) return null;
  const [body, suppliedSignature, extra] = token.split(".");
  if (!body || !suppliedSignature || extra !== undefined) return null;

  const expectedSignature = signature(body);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TemporaryProductImagePayload>;
    if (
      payload.storeId !== expectedStoreId ||
      typeof payload.storageKey !== "string" ||
      !/^(imgur|imagekit|cloudinary):.+$/.test(payload.storageKey) ||
      typeof payload.expiresAt !== "number" ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= now
    ) return null;
    return payload.storageKey;
  } catch {
    return null;
  }
}
