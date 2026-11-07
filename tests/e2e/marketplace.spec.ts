import { test, expect } from "@playwright/test";
import fs from "node:fs";

const sessions = JSON.parse(fs.readFileSync(".e2e-sessions.json", "utf8")) as Record<string, string>;
async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function signIn(page: import("@playwright/test").Page, token: string) {
  await page.context().addCookies([{
    name: "mtjr2_session", value: token, url: "http://127.0.0.1:3000",
    httpOnly: true, secure: false, sameSite: "Lax"
  }]);
}

test.describe("public marketplace journeys", () => {
  test("products, search and category discovery render", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: /Browse products|تصفّح المنتجات/i })).toBeVisible();
    const sponsored = page.getByTestId("sponsored-product").first();
    await sponsored.scrollIntoViewIfNeeded();
    await expect(sponsored).toBeVisible();
    const token = await sponsored.getAttribute("data-ad-token");
    expect(token).toBeTruthy();
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const eventResult = await page.evaluate(async ({ adToken, eventId }) => {
      const send = () => fetch("/api/advertising/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: adToken, type: "CLICK", eventId })
      });
      const first = await send();
      const firstBody = await first.json();
      const replay = await send();
      const replayBody = await replay.json();
      return { status: first.status, firstBody, replayStatus: replay.status, replayBody };
    }, { adToken: token!, eventId });
    expect(eventResult.status, JSON.stringify(eventResult.firstBody)).toBe(200);
    expect(eventResult.firstBody).toMatchObject({ accepted: true, duplicate: false });
    expect(eventResult.replayStatus, JSON.stringify(eventResult.replayBody)).toBe(200);
    expect(eventResult.replayBody).toMatchObject({ accepted: true, duplicate: true });
    await sponsored.getByRole("link").click();
    await expect(page).toHaveURL(/products/);
    await page.goto("/search?q=Nova");
    await expect(page.getByRole("heading", { name: /Search products|ابحث عن المنتجات/i })).toBeVisible();
    await expect(page.getByTestId("sponsored-product").first()).toBeVisible();
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: /Shop by category|تسوّق حسب الفئة/i })).toBeVisible();
    expect(sessions.categorySlug).toBeTruthy();
    await page.goto("/categories/" + encodeURIComponent(sessions.categorySlug));
    await expect(page.getByTestId("sponsored-product").first()).toBeVisible();
    expect(sessions.detailProductSlug).toBeTruthy();
    const detailResponse = await page.request.get("/api/products/" + encodeURIComponent(sessions.detailProductSlug) + "?locale=ar");
    expect(detailResponse.status()).toBe(200);
    const detailProduct = await detailResponse.json() as { name: string; variants: Array<{ prices: Array<{ marketId: string }> }> };
    const detailMarketId = detailProduct.variants.flatMap((variant) => variant.prices).at(0)?.marketId;
    expect(detailMarketId).toBeTruthy();
    const detailAdsResponse = await page.request.get("/api/advertising/sponsored?marketId=" + encodeURIComponent(detailMarketId!));
    expect(detailAdsResponse.status()).toBe(200);
    expect((await detailAdsResponse.json() as { items: unknown[] }).items.length).toBeGreaterThan(0);
    await page.goto("/products/" + encodeURIComponent(sessions.detailProductSlug));
    await expect(page.getByRole("heading", { name: detailProduct.name })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("sponsored-product").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("customer journey", () => {
  test("customer account and orders are accessible at desktop and mobile widths", async ({ page }) => {
    await signIn(page, sessions.customer);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/account");
    await expect(page.locator("main").last()).toBeVisible();
    await page.screenshot({ path: "test-results/customer-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account/orders");
    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/customer-mobile.png", fullPage: true });
    await page.goto("/account/sessions");
    const signOutAll = page.getByRole("button", { name: /Sign out all devices|تسجيل الخروج من جميع الأجهزة/i });
    await expect(signOutAll).toBeVisible();
    await signOutAll.click();
    await expect(page.getByRole("status")).toContainText(/Signed out of|تم تسجيل الخروج من/);
    const sessionsStatus = await page.evaluate(async () => (await fetch("/api/account/sessions", { cache: "no-store" })).status);
    expect(sessionsStatus).toBe(401);
  });
});

test.describe("seller journey", () => {
  test("seller workspace and advertising controls render responsively", async ({ page }) => {
    await signIn(page, sessions.seller);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/seller");
    await expect(page.locator("main")).toBeVisible();
    await page.goto("/seller/advertising");
    await expect(page.getByRole("heading", { name: /Advertising campaigns|الحملات الإعلانية/i })).toBeVisible();
    await page.screenshot({ path: "test-results/seller-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: /Advertising campaigns|الحملات الإعلانية/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/seller-mobile.png", fullPage: true });
  });
});

test.describe("Super Admin journey", () => {
  test("control center, analytics and advertising moderation render responsively", async ({ page }) => {
    await signIn(page, sessions.admin);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/dashboard");
    await expect(page.locator("main")).toBeVisible();
    await page.goto("/admin/control-panel");
    await expect(page.locator("main")).toBeVisible();
    await page.goto("/admin/advertising");
    await expect(page.getByRole("heading", { name: /Advertising review|مراجعة الإعلانات/i })).toBeVisible();
    await page.screenshot({ path: "test-results/admin-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: /Advertising review|مراجعة الإعلانات/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/admin-mobile.png", fullPage: true });
  });
});
