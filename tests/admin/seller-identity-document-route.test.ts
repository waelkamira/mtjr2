import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  sellerFindUnique: vi.fn()
}));

vi.mock("@/server/identity/permission-guard", () => ({
  requirePermission: mocks.requirePermission,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { seller: { findUnique: mocks.sellerFindUnique } }
}));

import { GET } from "@/app/api/admin/sellers/[sellerId]/identity-document/route";

describe("admin private seller identity document route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "private_test_key");
    mocks.requirePermission.mockResolvedValue({ userId: "admin-1" });
    mocks.sellerFindUnique.mockResolvedValue({
      id: "seller-1",
      ownerId: "owner-1",
      identityDocumentFileId: "file-1"
    });
  });

  it("returns a short-lived signed URL only after verifying private-file ownership", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: "https://ik.imagekit.io/test/private-seller-identity/document.jpg",
      isPrivateFile: true,
      tags: ["matjar-seller-identity", "user-owner-1"]
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    try {
      const response = await GET(new Request("https://matjar.example/api/admin/sellers/seller-1/identity-document"), {
        params: Promise.resolve({ sellerId: "seller-1" })
      });
      expect(response.status).toBe(302);
      const location = new URL(response.headers.get("location")!);
      expect(location.origin).toBe("https://ik.imagekit.io");
      expect(location.pathname).toBe("/test/private-seller-identity/document.jpg");
      expect(location.searchParams.get("ik-t")).toMatch(/^\d+$/);
      expect(location.searchParams.get("ik-s")).toMatch(/^[a-f0-9]{40}$/);
      expect(mocks.requirePermission).toHaveBeenCalledWith({ permissionKey: "users:manage" });
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refuses a document that is not private or belongs to another account", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: "https://ik.imagekit.io/test/document.jpg",
      isPrivateFile: true,
      tags: ["matjar-seller-identity", "user-someone-else"]
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    try {
      const response = await GET(new Request("https://matjar.example/api/admin/sellers/seller-1/identity-document"), {
        params: Promise.resolve({ sellerId: "seller-1" })
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("location")).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
