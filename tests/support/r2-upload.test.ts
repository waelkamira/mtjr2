import { afterEach, describe, expect, it, vi } from "vitest";
import { createR2DownloadUrl, createR2UploadUrl } from "@/server/storage/r2";

describe("R2 attachment URLs", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("binds the upload to create-only and content type headers", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "account");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET_NAME", "bucket");
    const now = new Date("2026-11-05T00:00:00Z");
    const upload = createR2UploadUrl("test/object", "image/png", now);
    const otherType = createR2UploadUrl("test/object", "image/jpeg", now);
    const params = new URL(upload.url).searchParams;
    expect(upload.headers).toEqual({ "Content-Type": "image/png", "If-None-Match": "*" });
    expect(params.get("X-Amz-SignedHeaders")).toBe("content-type;host;if-none-match");
    expect(params.get("X-Amz-Signature")).toBe("85b485bbb0336683ef4d4a7fe1c66ca3ad02cdb5c8c70605f676a024e2b04983");
    expect(params.get("X-Amz-Signature")).not.toBe(new URL(otherType.url).searchParams.get("X-Amz-Signature"));
    expect(new URL(createR2DownloadUrl("test/object", now).url).searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });
});
