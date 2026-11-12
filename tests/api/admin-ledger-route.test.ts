import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformManagement: vi.fn(),
  listLedgerAccounts: vi.fn(),
  listLedgerAccountEntries: vi.fn()
}));

vi.mock("@/server/identity/permission-guard", () => ({
  requirePlatformManagement: mocks.requirePlatformManagement,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  PermissionDeniedError: class PermissionDeniedError extends Error {}
}));
vi.mock("@/server/identity/access-errors", () => ({
  MfaEnrollmentRequiredError: class MfaEnrollmentRequiredError extends Error {},
  MfaVerificationRequiredError: class MfaVerificationRequiredError extends Error {},
  StepUpRequiredError: class StepUpRequiredError extends Error {}
}));
vi.mock("@/server/finance/ledger", () => ({
  listLedgerAccounts: mocks.listLedgerAccounts,
  listLedgerAccountEntries: mocks.listLedgerAccountEntries
}));

import { GET } from "@/app/api/admin/finance/ledger/route";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/server/identity/permission-guard";
import { StepUpRequiredError } from "@/server/identity/access-errors";

describe("admin general ledger read API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformManagement.mockResolvedValue({ userId: "platform-admin" });
    mocks.listLedgerAccounts.mockResolvedValue({ items: [], nextCursor: null });
    mocks.listLedgerAccountEntries.mockResolvedValue(null);
  });

  it("requires a signed-in platform administrator", async () => {
    mocks.requirePlatformManagement.mockRejectedValue(new AuthenticationRequiredError());

    const response = await GET(new Request("https://matjar.test/api/admin/finance/ledger"));

    expect(response.status).toBe(401);
    expect(mocks.listLedgerAccounts).not.toHaveBeenCalled();
  });

  it("denies users without platform management permission", async () => {
    mocks.requirePlatformManagement.mockRejectedValue(new PermissionDeniedError());

    const response = await GET(new Request("https://matjar.test/api/admin/finance/ledger"));

    expect(response.status).toBe(403);
    expect(mocks.listLedgerAccounts).not.toHaveBeenCalled();
  });

  it("returns an explicit MFA step-up response", async () => {
    mocks.requirePlatformManagement.mockRejectedValue(new StepUpRequiredError());

    const response = await GET(new Request("https://matjar.test/api/admin/finance/ledger"));

    expect(response.status).toBe(428);
    expect(mocks.listLedgerAccounts).not.toHaveBeenCalled();
  });

  it("rejects malformed filters before reading ledger data", async () => {
    const response = await GET(new Request("https://matjar.test/api/admin/finance/ledger?currencyCode=EURO"));

    expect(response.status).toBe(400);
    expect(mocks.listLedgerAccounts).not.toHaveBeenCalled();
  });

  it("returns filtered accounts and selected-account activity without caching", async () => {
    mocks.listLedgerAccounts.mockResolvedValue({
      items: [{ id: "account-1", code: "1000", currencyCode: "USD" }],
      nextCursor: null
    });
    mocks.listLedgerAccountEntries.mockResolvedValue({
      account: { id: "account-1", currencyCode: "USD" },
      items: [],
      nextCursor: null
    });

    const response = await GET(new Request("https://matjar.test/api/admin/finance/ledger?currencyCode=USD&accountType=ASSET&active=true&accountId=account-1&activityCursor=journal-line-0"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.listLedgerAccounts).toHaveBeenCalledWith({
      query: undefined,
      currencyCode: "USD",
      accountType: "ASSET",
      isActive: true,
      take: 50,
      cursor: undefined
    });
    expect(mocks.listLedgerAccountEntries).toHaveBeenCalledWith({ accountId: "account-1", take: 50, cursor: "journal-line-0" });
    expect(body.activity.account.id).toBe("account-1");
  });
});
