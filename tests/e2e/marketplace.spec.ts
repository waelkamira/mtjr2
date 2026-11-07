import { test, expect } from "@playwright/test";
import fs from "node:fs";

const sessions = JSON.parse(fs.readFileSync(".e2e-sessions.json", "utf8")) as Record<string, string>;

test.beforeEach(async ({ page }) => {
  // Simulate the trusted edge header overwritten by the hosting proxy.
  await page.context().setExtraHTTPHeaders({ "cf-connecting-ip": "203.0.113.10" });
});
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

test.describe("buyer checkout journey", () => {
  test("places a pending-payment order through cart, address, shipping and tax", async ({ page }) => {
    await signIn(page, sessions.buyer);
    await page.goto("/products/" + encodeURIComponent(sessions.detailProductSlug));
    const addToCart = page.getByRole("button", { name: /Add to cart|أضف إلى السلة/i });
    await expect(addToCart).toBeEnabled({ timeout: 15000 });
    await addToCart.click();
    await expect(page.getByText(/Added to your cart|أُضيف إلى سلة التسوق/i)).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /Shopping cart|سلة التسوق/i })).toBeVisible();
    const reviewCheckout = page.getByRole("button", { name: /Review checkout|مراجعة إتمام الشراء/i });
    await expect(reviewCheckout).toBeEnabled();
    await reviewCheckout.click();
    await expect(page.getByRole("heading", { name: /Review your order|مراجعة طلبك/i })).toBeVisible();

    await page.getByLabel(/Recipient name|اسم المستلم/i).fill("E2E Buyer");
    await page.getByLabel(/Phone \(international\)|رقم الهاتف/i).fill("+12025550123");
    await page.getByLabel(/Address line 1|العنوان، السطر الأول/i).fill("10 E2E Test Street");
    await page.getByLabel(/^City$|^المدينة$/i).fill("Seattle");
    await page.getByLabel(/Region \/ State|المنطقة/i).fill("Washington");
    await page.getByLabel(/Postal code|الرمز البريدي/i).fill("98101");
    await page.getByRole("button", { name: /Save delivery address|احفظ عنوان التوصيل/i }).click();
    await expect(page.getByText(/Saved to this quote|تم الحفظ لعرض السعر هذا/i)).toBeVisible();

    await page.getByRole("button", { name: /Load shipping options|تحميل خيارات الشحن/i }).click();
    await expect(page.getByText("E2E Standard Shipping")).toBeVisible();
    await page.getByRole("button", { name: /^Choose$|^اختر$/i }).first().click();
    await expect(page.getByRole("button", { name: /Selected|محدد/i })).toBeVisible();

    await page.getByRole("button", { name: /Calculate tax and total|احسب الضريبة/i }).click();
    await expect(page.getByText("E2E Market Tax")).toBeVisible();
    await page.getByRole("button", { name: /Place order|قدّم الطلب/i }).click();

    await expect(page).toHaveURL(/\/orders\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: /Thank you for your order|شكرًا لطلبك/i })).toBeVisible();
    await expect(page.locator("main").getByText(/Pending payment|بانتظار الدفع/i).first()).toBeVisible();
    await expect(page.getByText(/Payment is pending|الدفع قيد الانتظار/i)).toBeVisible();
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
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Active sessions|الجلسات النشطة/i })).toBeVisible();
    const sessionsResponse = await page.request.get("/api/account/sessions", { headers: { "Cache-Control": "no-store" } });
    expect(sessionsResponse.status()).toBe(200);
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
  test("control center, governance tools, privilege approval and advertising render responsively", async ({ page }) => {
    await signIn(page, sessions.customer);
    const deniedAdminResponse = await page.goto("/admin/control-panel");
    expect(deniedAdminResponse?.status()).toBe(404);

    await signIn(page, sessions.admin);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/dashboard");
    await expect(page.locator("main").last()).toBeVisible();
    await page.goto("/admin/control-panel");
    await expect(page.locator("main").last()).toBeVisible();

    await page.goto("/admin/control-panel/access-catalog");
    await expect(page.getByRole("heading", { name: /Roles & permissions/i })).toBeVisible();
    await page.goto("/admin/control-panel/audit-log");
    await expect(page.getByRole("heading", { name: /Platform audit log/i })).toBeVisible();
    await page.goto("/admin/control-panel/ai-assistant");
    await expect(page.getByRole("heading", { name: /AI assistant/i })).toBeVisible();
    const aiSettingsResponse = await page.request.get("/api/admin/control-panel/ai-assistant");
    expect(aiSettingsResponse.status()).toBe(200);
    const aiSettings = await aiSettingsResponse.json() as Record<string, unknown>;
    expect(aiSettings).not.toHaveProperty("apiKey");
    expect(JSON.stringify(aiSettings)).not.toContain("GROQ_API_KEY");

    await page.goto("/admin/control-panel/privilege-requests");
    await page.getByLabel(/User email/i).fill(sessions.privilegeTargetEmail);
    await page.getByLabel(/Business justification/i).fill("Independent E2E verification of the controlled Super Admin access workflow.");
    await page.getByRole("button", { name: /Submit access request/i }).click();
    await expect(page.getByRole("status")).toContainText(/Privilege request submitted/i);

    // The requester must not approve their own request.
    await page.getByRole("button", { name: /Approve & grant access/i }).first().click();
    await expect(page.getByRole("alert")).toContainText(/requester cannot approve or reject/i);

    // A second, independent Super Admin can review and approve the pending request.
    await signIn(page, sessions.adminReviewer);
    await page.goto("/admin/control-panel/privilege-requests");
    await page.getByRole("button", { name: /Approve & grant access/i }).first().click();
    await expect(page.getByRole("status")).toContainText(/Request approved/i);
    await expect(page.getByText("APPROVED").first()).toBeVisible();

    const auditResponse = await page.request.get("/api/admin/control-panel/audit-log?action=platform.privilege_request.created");
    expect(auditResponse.status()).toBe(200);
    const auditPayload = await auditResponse.json() as { events?: Array<{ action: string }> };
    expect(auditPayload.events?.some((event) => event.action === "platform.privilege_request.created")).toBe(true);

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
