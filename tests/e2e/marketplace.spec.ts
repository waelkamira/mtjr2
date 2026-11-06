import { test, expect } from "@playwright/test";
import fs from "node:fs";

const sessions = JSON.parse(fs.readFileSync(".e2e-sessions.json", "utf8")) as Record<string, string>;
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
    const sponsored = page.locator("article").filter({ hasText: /Sponsored|إعلان ممول/ }).first();
    await sponsored.scrollIntoViewIfNeeded();
    await expect(sponsored).toBeVisible();
    const clickResponse = page.waitForResponse((response) => response.url().includes("/api/advertising/events") && response.request().method() === "POST");
    await sponsored.getByRole("link").click();
    await clickResponse;
    await expect(page).toHaveURL(/products/);
    await page.goto("/search?q=Nova");
    await expect(page.getByRole("heading", { name: /Search products|ابحث عن المنتجات/i })).toBeVisible();
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: /Shop by category|تسوّق حسب الفئة/i })).toBeVisible();
  });
});

test.describe("customer journey", () => {
  test("customer account and orders are accessible at desktop and mobile widths", async ({ page }) => {
    await signIn(page, sessions.customer);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/account");
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: "test-results/customer-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account/orders");
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: "test-results/customer-mobile.png", fullPage: true });
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
    await page.screenshot({ path: "test-results/admin-mobile.png", fullPage: true });
  });
});
