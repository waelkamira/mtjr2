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
    await expect(page.locator("main").last()).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /Welcome back to your store|أهلاً بعودتك إلى متجرك/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Seller navigation|تنقل البائع/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Shipping services|خدمات الشحن/i })).toBeVisible();
    await expect(page.getByText(/This account is linked to one store|هذا الحساب مرتبط بمتجر واحد/i)).toBeVisible();
    await page.getByRole("button", { name: /Edit store profile|تعديل ملف المتجر/i }).click();
    await expect(page.getByRole("heading", { name: /Store profile|ملف المتجر/i })).toBeVisible();
    await page.getByRole("button", { name: /Cancel|إلغاء/i }).click();

    const workspaceResponse = await page.request.get("/api/seller/stores");
    expect(workspaceResponse.status()).toBe(200);
    const workspacePayload = await workspaceResponse.json() as { stores: Array<{ id: string }> };
    const storeId = workspacePayload.stores[0]?.id;
    expect(storeId).toBeTruthy();
    const shippingContact = `E2E Dispatch ${Date.now()}`;
    await page.getByLabel(/Shipping contact name|اسم مسؤول الشحن/i).fill(shippingContact);
    await page.getByLabel(/Shipping phone|هاتف الشحن/i).fill("+33123456789");
    await page.getByLabel(/Address line 1|العنوان — السطر الأول/i).fill("12 E2E Market Street");
    await page.getByLabel(/^City|المدينة$/i).fill("Strasbourg");
    await page.getByLabel(/Country code \(2 letters\)|رمز الدولة \(حرفان\)/i).fill("FR");
    await page.getByRole("button", { name: /Save shipping details|حفظ بيانات الشحن/i }).click();
    await expect(page.getByText(/Shipping address and contact details saved|تم حفظ عنوان الشحن وبيانات التواصل/i)).toBeVisible({ timeout: 15000 });
    const updatedWorkspaceResponse = await page.request.get("/api/seller/stores");
    expect(updatedWorkspaceResponse.status()).toBe(200);
    const updatedWorkspace = await updatedWorkspaceResponse.json() as { stores: Array<{ id: string; shippingContactName: string | null; shippingCity: string | null; shippingCountryCode: string | null }> };
    expect(updatedWorkspace.stores.find((store) => store.id === storeId)).toMatchObject({ shippingContactName: shippingContact, shippingCity: "Strasbourg", shippingCountryCode: "FR" });

    await page.goto("/seller/commissions");
    await expect(page.getByRole("heading", { name: /Commission statements|كشوف العمولات/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/seller-desktop.png", fullPage: true });
    await page.goto("/seller/advertising");
    await expect(page.getByRole("heading", { name: /Advertising campaigns|الحملات الإعلانية/i })).toBeVisible();
    await page.screenshot({ path: "test-results/seller-advertising-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/seller");
    await expect(page.getByRole("heading", { name: /Welcome back to your store|أهلاً بعودتك إلى متجرك/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Shipping services|خدمات الشحن/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/seller-mobile.png", fullPage: true });
    await page.goto("/seller/advertising");
    await expect(page.getByRole("heading", { name: /Advertising campaigns|الحملات الإعلانية/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/seller-advertising-mobile.png", fullPage: true });
  });
});

test.describe("seller catalog authoring", () => {
  test("seller can create a draft product and edit it from the catalog", async ({ page }) => {
    await signIn(page, sessions.seller);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/api/seller/products/media", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
            provider: "imgur",
            mimeType: "image/png",
            storageKey: "imgur:e2e-product-image",
            width: 800,
            height: 800
          }
        })
      });
    });
    await page.goto("/seller/products");
    await expect(page.getByRole("heading", { name: /Create product draft|إنشاء مسودة منتج/i })).toBeVisible();

    const storesResponse = await page.request.get("/api/seller/stores");
    expect(storesResponse.status()).toBe(200);
    const storePayload = await storesResponse.json() as { stores: Array<{ id: string }> };
    const storeId = storePayload.stores[0]?.id;
    expect(storeId).toBeTruthy();

    const categoryResponse = await page.request.get("/api/categories?limit=100&includeEmpty=true");
    expect(categoryResponse.status()).toBe(200);
    const categoryPayload = await categoryResponse.json() as { items: Array<{ id: string; slug: string; children?: Array<{ id: string; slug: string }> }> };
    const phoneCategory = categoryPayload.items.find((item) => item.slug === "phones-electronics")?.children?.find((item) => item.slug === "phones");
    expect(phoneCategory).toBeTruthy();

    const stamp = Date.now().toString();
    const productName = `E2E Seller Draft ${stamp}`;
    const updatedName = `E2E Seller Draft Updated ${stamp}`;
    await page.getByLabel(/Product name|اسم المنتج/i).fill(productName);
    await page.getByLabel(/URL slug|معرّف الرابط/i).fill(`e2e-seller-draft-${stamp}`);
    await page.getByLabel(/^SKU$/i).fill(`E2E-SKU-${stamp}`);
    await page.getByLabel(/Category|الفئة/i).selectOption(phoneCategory!.id);
    await expect(page.getByRole("heading", { name: /Category-specific details|الخصائص الخاصة بالفئة/i })).toBeVisible();

    // Exercise a partial Syria location: selecting a district stores its
    // display name in the product draft, and that accepted field must survive
    // strict server-side validation even before a locality is selected.
    const governoratesResponse = await page.request.get("/api/geography/governorates");
    expect(governoratesResponse.status()).toBe(200);
    const governorates = await governoratesResponse.json() as { items: Array<{ id: string; nameAr: string | null; nameEn: string }> };
    const damascus = governorates.items.find((item) => item.nameAr === "دمشق" || item.nameEn.toLowerCase() === "damascus");
    expect(damascus).toBeTruthy();
    await page.getByLabel(/Governorate|المحافظة/i).selectOption(damascus!.id);
    const districtsResponse = await page.request.get(`/api/geography/districts?governorateId=${encodeURIComponent(damascus!.id)}`);
    expect(districtsResponse.status()).toBe(200);
    const districts = await districtsResponse.json() as { items: Array<{ id: string }> };
    expect(districts.items.length).toBeGreaterThan(0);
    await page.getByLabel(/District|المنطقة/i).selectOption(districts.items[0].id);

    const priceInputs = page.getByLabel(/Selling price|سعر البيع/i);
    await expect(priceInputs.first()).toBeVisible();
    for (let index = 0; index < await priceInputs.count(); index += 1) {
      await priceInputs.nth(index).fill("1299");
    }

    await page.locator('input[type="file"][accept^="image/jpeg"]').first().setInputFiles({
      name: "e2e-product.png",
      mimeType: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
    });
    await expect(page.getByText(/Images uploaded successfully|تم رفع الصور بنجاح/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Create draft product|إنشاء مسودة منتج/i })).toBeEnabled();
    await page.getByRole("button", { name: /Preview image|معاينة الصورة/i }).first().click();
    await expect(page.getByRole("dialog", { name: /Image preview|معاينة الصورة/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /Image preview|معاينة الصورة/i })).toHaveCount(0);
    await page.getByRole("button", { name: /Create draft product|إنشاء مسودة منتج/i }).click();
    await expect(page.getByRole("status")).toContainText(/Draft product created|تم إنشاء مسودة المنتج/i, { timeout: 20000 });

    const catalogResponse = await page.request.get(`/api/seller/products?storeId=${encodeURIComponent(storeId!)}`);
    expect(catalogResponse.status()).toBe(200);
    const catalog = await catalogResponse.json() as { items: Array<{ id: string; name: string; status: string }> };
    const created = catalog.items.find((item) => item.name === productName);
    expect(created).toBeTruthy();
    expect(created!.status).toBe("DRAFT");

    const productCard = page.locator("article").filter({ hasText: productName }).first();
    await productCard.getByRole("button", { name: /Edit draft|تعديل المسودة/i }).click();
    const editForm = page.locator("form").filter({ hasText: /Edit draft product|تعديل مسودة المنتج/i });
    await expect(editForm).toBeVisible();
    await editForm.locator("input").nth(0).fill(updatedName);
    await editForm.locator("input").nth(1).fill(`e2e-seller-draft-updated-${stamp}`);
    await editForm.getByRole("button", { name: /Save changes|حفظ التغييرات/i }).click();
    await expect(page.getByRole("status")).toContainText(/Draft product updated|تم تحديث مسودة المنتج/i, { timeout: 20000 });

    const updatedCatalogResponse = await page.request.get(`/api/seller/products?storeId=${encodeURIComponent(storeId!)}`);
    expect(updatedCatalogResponse.status()).toBe(200);
    const updatedCatalog = await updatedCatalogResponse.json() as { items: Array<{ id: string; name: string; status: string }> };
    expect(updatedCatalog.items.some((item) => item.id === created!.id && item.name === updatedName && item.status === "DRAFT")).toBe(true);

    // Moderation and publication are separate, role-gated transitions:
    // an admin approves the edited draft, then its owning seller publishes it.
    await signIn(page, sessions.admin);
    const approvalResult = await page.evaluate(async (productId) => {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      return { status: response.status, body: await response.json() };
    }, created!.id);
    expect(approvalResult.status).toBe(200);
    expect(approvalResult.body).toMatchObject({ productId: created!.id, approvalStatus: "APPROVED" });

    await signIn(page, sessions.seller);
    const publishResult = await page.evaluate(async (productId) => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      return { status: response.status, body: await response.json() };
    }, created!.id);
    expect(publishResult.status).toBe(200);
    expect(publishResult.body).toMatchObject({ productId: created!.id, status: "ACTIVE" });

    const publicProductResponse = await page.request.get(`/api/products/${encodeURIComponent(`e2e-seller-draft-updated-${stamp}`)}?locale=en`);
    expect(publicProductResponse.status()).toBe(200);
    const publicProduct = await publicProductResponse.json() as { id: string; name: string; slug: string };
    expect(publicProduct).toMatchObject({ id: created!.id, name: updatedName, slug: `e2e-seller-draft-updated-${stamp}` });

    const publicSearchResponse = await page.request.get(`/api/products?q=${encodeURIComponent(updatedName)}`);
    expect(publicSearchResponse.status()).toBe(200);
    const publicSearch = await publicSearchResponse.json() as { items: Array<{ id: string }> };
    expect(publicSearch.items.some((item) => item.id === created!.id)).toBe(true);

    await page.goto(`/products/${encodeURIComponent(publicProduct.slug)}`);
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible({ timeout: 15000 });

    // The seller workspace must persist edits to an existing shipping service.
    await page.goto("/seller");
    await expect(page.getByRole("heading", { name: /Shipping services|خدمات الشحن/i })).toBeVisible();
    await expect(page.getByText("E2E Standard Shipping", { exact: false }).first()).toBeVisible();
    const shippingCard = page.getByText("E2E Standard Shipping", { exact: false }).first().locator("xpath=../..");
    await shippingCard.getByRole("button", { name: /Edit|تعديل/i }).click();
    const revisedShippingName = `E2E Standard Shipping Updated ${stamp}`;
    await page.getByLabel(/Service name|اسم الخدمة/i).fill(revisedShippingName);
    await page.getByLabel(/Description|الوصف/i).fill("Verified seller-managed shipping configuration");
    await page.getByRole("button", { name: /Save changes|حفظ التعديلات/i }).click();
    await expect(page.getByText(/Shipping service updated|تم تحديث خدمة الشحن/i)).toBeVisible({ timeout: 15000 });
    const shippingResponse = await page.request.get(`/api/seller/shipping-rates?storeId=${encodeURIComponent(storeId!)}`);
    expect(shippingResponse.status()).toBe(200);
    const shippingPayload = await shippingResponse.json() as { rates: Array<{ id: string; name: string; description: string | null }> };
    expect(shippingPayload.rates.some((rate) => rate.name === revisedShippingName && rate.description === "Verified seller-managed shipping configuration")).toBe(true);
  });

  test("loads Akaar category fields, Syrian administrative locations and Leaflet map", async ({ page }) => {
    await signIn(page, sessions.seller);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/seller/products");
    await expect(page.getByRole("heading", { name: /Products|المنتجات/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Create product draft|إنشاء مسودة منتج/i })).toBeVisible();

    const categoryResponse = await page.request.get("/api/categories?limit=100&includeEmpty=true");
    expect(categoryResponse.status()).toBe(200);
    const categoryPayload = await categoryResponse.json() as { items: Array<{ id: string; slug: string; children?: Array<{ id: string; slug: string }> }> };
    const phoneRoot = categoryPayload.items.find((item) => item.slug === "phones-electronics");
    const phoneCategory = phoneRoot?.children?.find((item) => item.slug === "phones");
    expect(phoneCategory).toBeTruthy();
    const locale = await page.locator("html").getAttribute("lang") || "en";
    const attributesResponse = await page.request.get(`/api/categories/${encodeURIComponent(phoneCategory!.id)}/attributes?locale=${encodeURIComponent(locale)}`);
    expect(attributesResponse.status()).toBe(200);
    const attributes = await attributesResponse.json() as { items: Array<{ label: string; required: boolean }> };
    expect(attributes.items.length).toBeGreaterThan(0);

    await page.getByLabel(/Category|الفئة/i).selectOption(phoneCategory!.id);
    await expect(page.getByRole("heading", { name: /Category-specific details|الخصائص الخاصة بالفئة/i })).toBeVisible();
    await expect(page.getByText(attributes.items[0].label, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Product location in Syria|موقع المنتج في سوريا/i })).toBeVisible();
    const map = page.getByRole("application", { name: /Product location map|خريطة تحديد موقع المنتج/i });
    await expect(map).toBeVisible();
    await expect(page.getByLabel(/Governorate|المحافظة/i)).toBeVisible();

    const governoratesResponse = await page.request.get("/api/geography/governorates");
    expect(governoratesResponse.status()).toBe(200);
    const governorates = await governoratesResponse.json() as { pagination: { total: number }; items: Array<{ id: string; nameAr: string | null; nameEn: string; latitude: number | null; longitude: number | null }> };
    expect(governorates.pagination.total).toBe(14);
    const damascus = governorates.items.find((item) => item.nameAr === "دمشق" || item.nameEn.toLowerCase() === "damascus");
    expect(damascus).toBeTruthy();
    await page.getByLabel(/Governorate|المحافظة/i).selectOption(damascus!.id);
    if (damascus!.latitude !== null && damascus!.longitude !== null) {
      await expect(map).toHaveAttribute("data-map-zoom", "7", { timeout: 10000 });
    }

    const districtsResponse = await page.request.get(`/api/geography/districts?governorateId=${encodeURIComponent(damascus!.id)}`);
    expect(districtsResponse.status()).toBe(200);
    const districts = await districtsResponse.json() as { items: Array<{ id: string; latitude: number | null; longitude: number | null }> };
    expect(districts.items.length).toBeGreaterThan(0);
    const selectedDistrict = districts.items.find((item) => item.latitude !== null && item.longitude !== null) ?? districts.items[0];
    await page.getByLabel(/District|المنطقة/i).selectOption(selectedDistrict.id);
    if (selectedDistrict.latitude !== null && selectedDistrict.longitude !== null) {
      await expect(map).toHaveAttribute("data-map-zoom", "10", { timeout: 10000 });
    }

    const subdistrictsResponse = await page.request.get(`/api/geography/subdistricts?districtId=${encodeURIComponent(selectedDistrict.id)}`);
    expect(subdistrictsResponse.status()).toBe(200);
    const subdistricts = await subdistrictsResponse.json() as { items: Array<{ id: string; latitude: number | null; longitude: number | null }> };
    expect(subdistricts.items.length).toBeGreaterThan(0);
    let selectedSubdistrictId = "";
    let selectedSubdistrictHasCoordinates = false;
    let selectedLocalityId = "";
    let selectedLocalityHasCoordinates = false;
    for (const subdistrict of subdistricts.items) {
      const response = await page.request.get(`/api/geography/localities?districtId=${encodeURIComponent(selectedDistrict.id)}&subdistrictId=${encodeURIComponent(subdistrict.id)}`);
      const payload = await response.json() as { items: Array<{ id: string; latitude: number | null; longitude: number | null }> };
      const locality = payload.items.find((item) => item.latitude !== null && item.longitude !== null) ?? payload.items[0];
      if (locality) {
        selectedSubdistrictId = subdistrict.id;
        selectedSubdistrictHasCoordinates = subdistrict.latitude !== null && subdistrict.longitude !== null;
        selectedLocalityId = locality.id;
        selectedLocalityHasCoordinates = locality.latitude !== null && locality.longitude !== null;
        break;
      }
    }
    expect(selectedSubdistrictId).toBeTruthy();
    expect(selectedLocalityId).toBeTruthy();
    await page.getByLabel(/Subdistrict|الناحية/i).selectOption(selectedSubdistrictId);
    if (selectedSubdistrictHasCoordinates) {
      await expect(map).toHaveAttribute("data-map-zoom", "12", { timeout: 10000 });
    }
    await expect(page.getByLabel(/City \/ town \/ village|المدينة \/ البلدة \/ القرية/i)).toBeEnabled();
    await page.getByLabel(/City \/ town \/ village|المدينة \/ البلدة \/ القرية/i).selectOption(selectedLocalityId);
    await expect(map).toHaveClass(/leaflet-container/, { timeout: 15000 });
    if (selectedLocalityHasCoordinates) await expect(map).toHaveAttribute("data-map-zoom", "15", { timeout: 10000 });

    const zoomBeforeWheel = Number(await map.getAttribute("data-map-zoom"));
    await map.hover();
    await page.mouse.wheel(0, -600);
    await expect.poll(async () => Number(await map.getAttribute("data-map-zoom"))).toBeGreaterThan(zoomBeforeWheel);

    // Neighbourhoods are currently seller-entered (not an official OpenSyria
    // administrative level); leaving the field zooms to the selected locality
    // pin so the seller can place it more precisely.
    if (selectedLocalityHasCoordinates) {
      const neighborhood = page.getByLabel(/Neighbourhood \(local name\)|الحي \(الاسم المحلي\)/i);
      await neighborhood.fill("Al-Mazzeh");
      await neighborhood.blur();
      await expect(map).toHaveAttribute("data-map-zoom", "16", { timeout: 10000 });
    }
  });
});

test.describe("Super Admin journey", () => {
  test("control center, governance tools, privilege approval and advertising render responsively", async ({ page }) => {
    // Reuse the buyer identity whose authenticated checkout was verified above.
    await signIn(page, sessions.buyer);
    const deniedCatalogResponse = await page.request.get("/api/admin/control-panel/access-catalog");
    expect(deniedCatalogResponse.status()).toBe(403);
    await page.goto("/admin/control-panel");
    await expect(page.getByRole("heading", { name: /We couldn’t find that page|لم نتمكن من العثور على هذه الصفحة/i })).toBeVisible();

    await signIn(page, sessions.admin);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/dashboard");
    await expect(page.locator("main").last()).toBeVisible();
    await page.goto("/admin/control-panel");
    await expect(page.locator("main").last()).toBeVisible();

    await page.goto("/admin/control-panel/access-catalog");
    await expect(page.getByRole("heading", { name: /Roles & permissions|الأدوار والصلاحيات/i })).toBeVisible();
    await page.goto("/admin/control-panel/audit-log");
    await expect(page.getByRole("heading", { name: /Platform audit log|سجل تدقيق المنصة/i })).toBeVisible();
    await page.goto("/admin/control-panel/ai-assistant");
    await expect(page.getByRole("heading", { name: /AI assistant|المساعد الذكي/i })).toBeVisible();
    const aiSettingsResponse = await page.request.get("/api/admin/control-panel/ai-assistant");
    expect(aiSettingsResponse.status()).toBe(200);
    const aiSettings = await aiSettingsResponse.json() as Record<string, unknown>;
    expect(aiSettings).not.toHaveProperty("apiKey");
    expect(JSON.stringify(aiSettings)).not.toContain("GROQ_API_KEY");

    await page.goto("/admin/control-panel/privilege-requests");
    await page.getByLabel(/User email|البريد الإلكتروني للمستخدم/i).fill(sessions.privilegeTargetEmail);
    await page.getByLabel(/Business justification|مبررات العمل/i).fill("Independent E2E verification of the controlled Super Admin access workflow.");
    await page.getByRole("button", { name: /Submit access request|إرسال طلب الوصول/i }).click();
    await expect(page.getByRole("status")).toContainText(/Privilege request submitted|تم إرسال طلب الامتياز للمراجعة المستقلة/i);

    // The requester must not approve their own request.
    await page.getByRole("button", { name: /Approve & grant access|الموافقة ومنح الصلاحية/i }).first().click();
    await expect(page.locator("main").getByRole("alert")).toContainText(/requester cannot approve or reject/i);

    // The target has no platform access before approval.
    await signIn(page, sessions.privilegeTarget);
    await page.goto("/admin/control-panel");
    await expect(page.getByRole("heading", { name: /We couldn’t find that page|لم نتمكن من العثور على هذه الصفحة/i })).toBeVisible();

    // A second, independent Super Admin can review and approve the pending request.
    await signIn(page, sessions.adminReviewer);
    await page.goto("/admin/control-panel/privilege-requests");
    await page.getByRole("button", { name: /Approve & grant access|الموافقة ومنح الصلاحية/i }).first().click();
    await expect(page.getByRole("status")).toContainText(/Request approved|تمت الموافقة على الطلب ومنح صلاحية الوصول إلى المنصة/i);
    await expect(page.getByText("APPROVED").first()).toBeVisible();

    const auditResponse = await page.request.get("/api/admin/control-panel/audit-log?action=platform.privilege_request.created");
    expect(auditResponse.status()).toBe(200);
    const auditPayload = await auditResponse.json() as { events?: Array<{ action: string }> };
    expect(auditPayload.events?.some((event) => event.action === "platform.privilege_request.created")).toBe(true);

    // Once access is granted, the target is still gated until MFA enrollment.
    await signIn(page, sessions.privilegeTarget);
    await page.goto("/admin/control-panel");
    await expect(page).toHaveURL(/\/account\/security\?mfa=setup/);
    await signIn(page, sessions.adminReviewer);

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
