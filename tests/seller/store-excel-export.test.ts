import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadSellerStoreWorkbook } from "@/features/seller/store-excel-export";

describe("seller store Excel export", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads a multi-sheet workbook with escaped text", async () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn()
    };
    const appendChild = vi.fn();
    vi.stubGlobal("window", {
      document: {
        createElement: vi.fn(() => anchor),
        body: { appendChild }
      }
    });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:matjar-export");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    downloadSellerStoreWorkbook({
      store: {
        storeNumber: "1001", name: "A&B <Market>\u0001", slug: "market", status: "ACTIVE",
        description: null, publicPhone: null, publicAddress: null,
        shippingContactName: null, shippingPhone: null, shippingAddressLine1: null,
        shippingAddressLine2: null, shippingCity: null, shippingRegion: null,
        shippingPostalCode: null, shippingCountryCode: null, shippingInstructions: null,
        shippingPolicy: null, returnsPolicy: null, privacyPolicy: null, termsOfSale: null,
        markets: [], warehouses: []
      },
      analytics: {
        range: { from: "2026-11-01", to: "2026-11-10", days: 10 },
        metrics: {
          totalOrders: 0, grossSalesByCurrency: [{ currencyCode: "EUR", amountMinor: "12345", orderCount: 1, minorUnit: 2, currencyName: "Euro" }], activeProducts: 0, pendingProducts: 0,
          averageRating: null, reviewCount: 0, requestedReturns: 0
        },
        orderStatuses: [], dailySales: [{ day: "2026-11-10", currencyCode: "EUR", amountMinor: "12345", orderCount: 1 }], topProducts: []
      },
      inventory: [],
      orders: [{ status: "DELIVERED", store: { name: "A&B <Market>" }, order: { orderNumber: "M-1", placedAt: "2026-11-10T10:00:00.000Z", currencyCode: "EUR", currency: { minorUnit: 2 } }, totalMinor: "2500" }]
    });

    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("matjar-store-1001-export.xls");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:matjar-export");
    const workbook = createObjectURL.mock.calls[0][0] as Blob;
    const xml = await workbook.text();
    expect(xml).toContain('ss:Name="Store"');
    expect(xml).toContain('ss:Name="Performance"');
    expect(xml).toContain('ss:Name="Top products"');
    expect(xml).toContain('ss:Name="Inventory"');
    expect(xml).toContain('ss:Name="Recent orders"');
    expect(xml).toContain("A&amp;B &lt;Market&gt;");
    expect(xml).toContain("123.45");
    expect(xml).toContain("25.00");
    expect(xml).not.toContain(String.fromCharCode(1));
  });
});
