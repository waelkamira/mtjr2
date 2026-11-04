import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guestFindUnique: vi.fn(),
  transaction: vi.fn(),
  quoteFindFirst: vi.fn(),
  addressUpsert: vi.fn(),
  shippingSelectionDeleteMany: vi.fn(),
  taxSnapshotDeleteMany: vi.fn(),
  savedAddressFindFirst: vi.fn(),
  savedAddressCreate: vi.fn(),
  getCurrentSession: vi.fn(),
  getCheckoutQuote: vi.fn()
}));

const tx = {
  checkoutQuote: { findFirst: mocks.quoteFindFirst },
  checkoutQuoteAddress: { upsert: mocks.addressUpsert },
  checkoutShippingSelection: { deleteMany: mocks.shippingSelectionDeleteMany },
  checkoutTaxSnapshot: { deleteMany: mocks.taxSnapshotDeleteMany },
  userAddress: { findFirst: mocks.savedAddressFindFirst, create: mocks.savedAddressCreate }
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { guestSession: { findUnique: mocks.guestFindUnique }, $transaction: mocks.transaction }
}));
vi.mock("@/server/identity/current-session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/server/checkout/quotes", () => ({ getCheckoutQuote: mocks.getCheckoutQuote }));

import { setCheckoutDeliveryAddress } from "@/server/checkout/delivery-address";

describe("checkout delivery address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.getCheckoutQuote.mockResolvedValue({ status: "ACTIVE", market: { code: "NL" } });
    mocks.guestFindUnique.mockResolvedValue({
      id: "guest-1", expiresAt: new Date(Date.now() + 60_000), convertedAt: null
    });
    mocks.quoteFindFirst.mockResolvedValue({
      id: "quote-1",
      market: { country: { id: "country-nl", iso2: "NL", name: "Netherlands", isActive: true } }
    });
    mocks.addressUpsert.mockImplementation(async ({ create }) => ({ id: "quote-address-1", ...create }));
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  it("stores a guest address snapshot using the quote market country and invalidates dependent selections", async () => {
    const result = await setCheckoutDeliveryAddress("guest-token", "quote-1", {
      recipientName: "Alex Example", phone: "+31612345678",
      line1: "Main Street 10", city: "Amsterdam"
    });
    expect(result.countryCode).toBe("NL");
    expect(mocks.addressUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { quoteId: "quote-1" },
      create: expect.objectContaining({ countryCode: "NL", countryName: "Netherlands", sourceAddressId: null })
    }));
    expect(mocks.shippingSelectionDeleteMany).toHaveBeenCalledWith({ where: { quoteId: "quote-1" } });
    expect(mocks.taxSnapshotDeleteMany).toHaveBeenCalledWith({ where: { quoteId: "quote-1" } });
  });

  it("does not allow a buyer to override the market country", async () => {
    await expect(setCheckoutDeliveryAddress("guest-token", "quote-1", {
      recipientName: "Alex Example", phone: "+31612345678",
      line1: "Main Street 10", city: "Amsterdam", countryCode: "US"
    })).rejects.toThrow();
    expect(mocks.addressUpsert).not.toHaveBeenCalled();
  });

  it("rejects saved-address references for guest checkouts", async () => {
    await expect(setCheckoutDeliveryAddress("guest-token", "quote-1", {
      addressId: "someone-elses-address"
    })).rejects.toThrow("Saved addresses are available only after signing in.");
  });
});
