"use client";

type StoreExport = {
  storeNumber: string; name: string; slug: string; status: string;
  description: string | null; publicPhone: string | null; publicAddress: string | null;
  shippingContactName: string | null; shippingPhone: string | null;
  shippingAddressLine1: string | null; shippingAddressLine2: string | null;
  shippingCity: string | null; shippingRegion: string | null; shippingPostalCode: string | null;
  shippingCountryCode: string | null; shippingInstructions: string | null;
  shippingPolicy: string | null; returnsPolicy: string | null; privacyPolicy: string | null; termsOfSale: string | null;
  markets: Array<{ market: { code: string; name: string } }>;
  warehouses: Array<{ code: string; name: string; _count: { inventories: number } }>;
};
type AnalyticsExport = {
  range: { from: string; to: string; days: number };
  metrics: {
    totalOrders: number | null;
    grossSalesByCurrency: Array<{ currencyCode: string; amountMinor: string; orderCount: number; minorUnit: number; currencyName: string }>;
    activeProducts: number | null; pendingProducts: number | null;
    averageRating: number | null; reviewCount: number | null; requestedReturns: number | null;
  };
  orderStatuses: Array<{ status: string; count: number }>;
  dailySales: Array<{ day: string; currencyCode: string; amountMinor: string; orderCount: number }>;
  topProducts: Array<{ productId: string | null; name: string; unitsSold: number }>;
};
type InventoryExport = {
  quantityOnHand: number; quantityReserved: number; quantityAvailable: number; reorderPoint: number; isLowStock: boolean;
  warehouse: { code: string; name: string };
  variant: { sku: string | null; name: string | null; product: { name: string; slug: string } };
};
type OrderExport = {
  status: string; store: { name: string };
  order: { orderNumber: string; placedAt: string; currencyCode: string; currency: { minorUnit: number } };
  totalMinor: string;
};

type Cell = string | number | boolean | null | undefined;
type Sheet = { name: string; rows: Cell[][] };

function xml(value: Cell): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function cell(value: Cell): string {
  if (typeof value === "number" && Number.isFinite(value)) return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  if (typeof value === "boolean") return `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`;
}
function worksheet(sheet: Sheet): string {
  const rows = sheet.rows.map((row) => `<Row>${row.map(cell).join("")}</Row>`).join("");
  return `<Worksheet ss:Name="${xml(sheet.name)}"><Table>${rows}</Table></Worksheet>`;
}

/** Exports a multi-sheet Excel-compatible workbook without sending store data to a third party. */
export function downloadSellerStoreWorkbook(input: {
  store: StoreExport; analytics: AnalyticsExport; inventory: InventoryExport[]; orders: OrderExport[];
}) {
  const { store, analytics, inventory, orders } = input;
  const sheets: Sheet[] = [
    { name: "Store", rows: [
      ["Field", "Value"],
      ["Store number", store.storeNumber], ["Store name", store.name], ["Store slug", store.slug], ["Status", store.status],
      ["Description", store.description], ["Public phone", store.publicPhone], ["Public address", store.publicAddress],
      ["Shipping contact", store.shippingContactName], ["Shipping phone", store.shippingPhone],
      ["Shipping address line 1", store.shippingAddressLine1], ["Shipping address line 2", store.shippingAddressLine2],
      ["Shipping city", store.shippingCity], ["Shipping region", store.shippingRegion],
      ["Shipping postal code", store.shippingPostalCode], ["Shipping country", store.shippingCountryCode],
      ["Shipping instructions", store.shippingInstructions], ["Shipping policy", store.shippingPolicy],
      ["Returns policy", store.returnsPolicy], ["Privacy policy", store.privacyPolicy], ["Terms of sale", store.termsOfSale],
      ["Markets", store.markets.map((item) => item.market.name + " (" + item.market.code + ")").join("; ")],
      ["Warehouses", store.warehouses.map((item) => item.name + " (" + item.code + ")").join("; ")]
    ]},
    { name: "Performance", rows: [
      ["Metric", "Value", "Currency", "Period"],
      ["From", analytics.range.from, "", analytics.range.days + " days"], ["To", analytics.range.to],
      ["Orders", analytics.metrics.totalOrders], ["Active products", analytics.metrics.activeProducts],
      ["Pending products", analytics.metrics.pendingProducts], ["Average rating", analytics.metrics.averageRating],
      ["Review count", analytics.metrics.reviewCount], ["Requested returns", analytics.metrics.requestedReturns],
      ["Gross sales", "", "", ""],
      ...analytics.metrics.grossSalesByCurrency.map((item) => ["Gross sales", item.amountMinor, item.currencyCode, item.orderCount + " orders"]),
      ["Order status", "Count"], ...analytics.orderStatuses.map((item) => [item.status, item.count]),
      ["Daily sales", "Amount minor", "Currency", "Orders"],
      ...analytics.dailySales.map((item) => [item.day, item.amountMinor, item.currencyCode, item.orderCount])
    ]},
    { name: "Top products", rows: [
      ["Product", "Product ID", "Units sold"],
      ...analytics.topProducts.map((item) => [item.name, item.productId, item.unitsSold])
    ]},
    { name: "Inventory", rows: [
      ["Product", "Variant", "SKU", "Warehouse", "On hand", "Reserved", "Available", "Reorder point", "Low stock"],
      ...inventory.map((item) => [item.variant.product.name, item.variant.name, item.variant.sku, item.warehouse.name,
        item.quantityOnHand, item.quantityReserved, item.quantityAvailable, item.reorderPoint, item.isLowStock])
    ]},
    { name: "Recent orders", rows: [
      ["Order number", "Date", "Store", "Status", "Total minor units", "Currency"],
      ...orders.map((item) => [item.order.orderNumber, item.order.placedAt, item.store.name, item.status, item.totalMinor, item.order.currencyCode])
    ]}
  ];
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
${sheets.map(worksheet).join("\n")}
</Workbook>`;
  const blob = new Blob(["\uFEFF", workbookXml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `matjar-store-${store.storeNumber || store.slug}-export.xls`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
