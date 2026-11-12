import { test, expect } from "@playwright/test";
import fs from "node:fs";

const sessions = JSON.parse(fs.readFileSync(".e2e-sessions.json", "utf8")) as Record<string, string>;

test.beforeEach(async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "cf-connecting-ip": "203.0.113.11" });
});

test("platform admin can inspect immutable ledger activity without financial mutation controls", async ({ page }) => {
  await page.context().addCookies([{
    name: "mtjr2_session",
    value: sessions.admin,
    url: "http://127.0.0.1:3000",
    httpOnly: true,
    secure: false,
    sameSite: "Lax"
  }]);

  await page.goto("/admin/finance/ledger");
  await expect(page.getByRole("heading", { name: /General ledger|دفتر الأستاذ العام/i })).toBeVisible();
  await expect(page.getByText(/Read only|قراءة فقط/i).first()).toBeVisible();
  await expect(page.getByText(/E2E-CASH/).first()).toBeVisible();

  await page.getByRole("button", { name: /E2E-CASH/ }).click();
  await expect(page.getByText("E2E Cash Account").first()).toBeVisible();
  await expect(page.getByText("E2E ledger sample entry")).toBeVisible();
  await expect(page.getByText("E2E sample debit")).toBeVisible();
  await expect(page.getByText("E2E_LEDGER")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Debit|مدين/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Credit|دائن/i })).toBeVisible();

  const accountsResponse = await page.request.get("/api/admin/finance/ledger?q=E2E-CASH");
  expect(accountsResponse.status()).toBe(200);
  const accountsBody = await accountsResponse.json() as { accounts: { items: Array<{ id: string }> } };
  const accountId = accountsBody.accounts.items[0]?.id;
  expect(accountId).toBeTruthy();
  const ledgerResponse = await page.request.get("/api/admin/finance/ledger?accountId=" + encodeURIComponent(accountId!));
  expect(ledgerResponse.status()).toBe(200);
  const ledgerBody = await ledgerResponse.json() as { activity: { items: Array<{ journalEntry: { description: string } }> } };
  expect(ledgerBody.activity.items.some((line) => line.journalEntry.description === "E2E ledger sample entry")).toBe(true);
  await expect(page.getByRole("button", { name: /Post journal|Create journal|إنشاء قيد|ترحيل قيد/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Refund|Payout|Withdraw|استرداد|تحويل|سحب/i })).toHaveCount(0);
});
