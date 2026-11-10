import "server-only";

import { createHash } from "node:crypto";

type DeleteResult = "deleted" | "unsupported";

/**
 * Delete a product image only after its database reference has been removed.
 * All credentials are server-side. Unsupported providers are left untouched.
 */
export async function deleteProductImage(storageKey: string): Promise<DeleteResult> {
  const separator = storageKey.indexOf(":");
  if (separator <= 0 || separator === storageKey.length - 1) {
    throw new Error("Invalid product image storage key.");
  }
  const provider = storageKey.slice(0, separator);
  const providerParts = storageKey.slice(separator + 1).split(":");
  const storedImgurClientId = provider === "imgur" && providerParts.length === 2 ? providerParts[0] : undefined;
  const assetId = provider === "imgur" && providerParts.length === 2 ? providerParts[1] : providerParts.join(":");

  if (provider === "imgur") {
    if (providerParts.length > 2 || !/^[A-Za-z0-9_-]{4,160}$/.test(assetId)) throw new Error("Invalid Imgur image identifier.");
    if (storedImgurClientId && !/^[A-Za-z0-9_-]{4,160}$/.test(storedImgurClientId)) throw new Error("Invalid Imgur Client ID.");
    const token = process.env.IMGUR_ACCESS_TOKEN?.trim();
    const configuredClientId = (process.env.IMGUR_CLIENT_IDS?.trim() || process.env.IMGUR_CLIENT_ID?.trim() || "")
      .split(/[;,\n]/).map((value) => value.trim()).find(Boolean);
    const clientId = storedImgurClientId || configuredClientId;
    const authorization = storedImgurClientId
      ? `Client-ID ${storedImgurClientId}`
      : token ? `Bearer ${token}` : clientId ? `Client-ID ${clientId}` : null;
    if (!authorization) return "unsupported";
    const response = await fetch(`https://api.imgur.com/3/image/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
    if (response.ok || response.status === 404) return "deleted";
    throw new Error(`Imgur image deletion failed (HTTP ${response.status}).`);
  }

  if (provider === "imagekit") {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(assetId)) throw new Error("Invalid ImageKit file identifier.");
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
    if (!privateKey) return "unsupported";
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
    if (response.ok || response.status === 404) return "deleted";
    throw new Error(`ImageKit image deletion failed (HTTP ${response.status}).`);
  }

  if (provider === "cloudinary") {
    if (!/^[A-Za-z0-9_/-]{1,255}$/.test(assetId) || assetId.includes("..") || assetId.includes("//")) {
      throw new Error("Invalid Cloudinary public identifier.");
    }
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloudName || !apiKey || !apiSecret) return "unsupported";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHash("sha1")
      .update(`public_id=${assetId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");
    const body = new URLSearchParams({ public_id: assetId, timestamp, api_key: apiKey, signature });
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
    const result = await response.json().catch(() => null) as { result?: string } | null;
    if (response.ok && (result?.result === "ok" || result?.result === "not found")) return "deleted";
    throw new Error(`Cloudinary image deletion failed (HTTP ${response.status}).`);
  }

  return "unsupported";
}
