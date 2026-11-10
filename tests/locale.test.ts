import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/identity/request-security", () => ({ validateIdentityMutationRequest: () => null }));
import { NextRequest } from "next/server";
import { POST } from "@/app/api/locale/route";
import { defaultLocale, isLocale, translate } from "@/lib/locale";

describe("locale preference", () => {
  it("defaults to Arabic and only accepts the supported language codes", () => {
    expect(defaultLocale).toBe("ar");
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(translate("ar", "Search", "بحث")).toBe("بحث");
    expect(translate("en", "Search", "بحث")).toBe("Search");
  });

  it("persists a supported language in a secure cookie when using HTTPS", async () => {
    const request = new NextRequest("https://example.test/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en" })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mtjr-locale=en");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
  });

  it("rejects unsupported language codes", async () => {
    const request = new NextRequest("http://example.test/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "fr" })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
