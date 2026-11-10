import { AuditActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  AuthenticationRequiredError,
  MfaEnrollmentRequiredError,
  MfaVerificationRequiredError,
  requireCurrentSession
} from "@/server/identity/current-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cell = string | number | Date | null | undefined;

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function worksheet(name: string, rows: Cell[][]) {
  const body = rows.map((row) =>
    `<Row>${row.map((value) => {
      const text = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
      return `<Cell><Data ss:Type="String">${xmlEscape(text)}</Data></Cell>`;
    }).join("")}</Row>`
  ).join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${body}</Table></Worksheet>`;
}

function workbook(sheets: Array<{ name: string; rows: Cell[][] }>) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.map((sheet) => worksheet(sheet.name, sheet.rows)).join("")}
</Workbook>`;
}

export async function GET(_request: Request, context: { params: Promise<{ storeId: string }> }): Promise<Response> {
  try {
    const actor = await requireCurrentSession();
    const { storeId } = await context.params;
    if (!storeId || storeId.length > 128) return Response.json({ error: "A valid store ID is required." }, { status: 400 });

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, storeNumber: true, name: true, slug: true, status: true, description: true,
        publicPhone: true, publicAddress: true, shippingContactName: true, shippingPhone: true,
        shippingAddressLine1: true, shippingAddressLine2: true, shippingCity: true,
        shippingRegion: true, shippingPostalCode: true, shippingCountryCode: true,
        shippingInstructions: true, createdAt: true, updatedAt: true,
        seller: { select: { ownerId: true, legalName: true, displayName: true, contactName: true, contactEmail: true, phoneNumber: true } }
      }
    });
    if (!store) return Response.json({ error: "Store not found." }, { status: 404 });
    if (store.seller.ownerId !== actor.userId) return Response.json({ error: "Only the store owner can export the complete store workbook." }, { status: 403 });

    const [products, inventory] = await Promise.all([
      prisma.product.findMany({
        where: { storeId },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 5001,
        select: {
          id: true, productNumber: true, name: true, slug: true, description: true, status: true,
          approvalStatus: true, city: true, district: true, streetAddress: true,
          createdAt: true, updatedAt: true,
          variants: {
            orderBy: { sku: "asc" },
            select: {
              id: true, sku: true, barcode: true, name: true, isActive: true, weightGrams: true,
              prices: { orderBy: [{ marketId: "asc" }, { currencyCode: "asc" }], select: {
                market: { select: { code: true, name: true } },
                currencyCode: true, amountMinor: true, compareAtMinor: true,
                currency: { select: { minorUnit: true } }
              } }
            }
          }
        }
      }),
      prisma.inventory.findMany({
        where: { warehouse: { storeId } },
        orderBy: [{ warehouse: { name: "asc" } }, { id: "asc" }],
        take: 5001,
        select: {
          quantityOnHand: true, quantityReserved: true, quantityQuarantined: true,
          reorderPoint: true, updatedAt: true,
          warehouse: { select: { code: true, name: true, isActive: true } },
          variant: { select: { sku: true, barcode: true, name: true, product: { select: { id: true, name: true, storeId: true } } } }
        }
      })
    ]);

    const productRows: Cell[][] = [[
      "Product ID", "Product number", "Name", "Slug", "Description", "Status",
      "Approval status", "City", "District", "Street address", "Created at", "Updated at"
    ], ...products.slice(0, 5000).map((product) => [
      product.id, product.productNumber.toString(), product.name, product.slug, product.description,
      product.status, product.approvalStatus, product.city, product.district, product.streetAddress,
      product.createdAt, product.updatedAt
    ])];

    const variantRows: Cell[][] = [[
      "Product", "Variant ID", "SKU", "Barcode", "Variant name", "Active", "Weight grams",
      "Market code", "Market", "Currency", "Amount minor", "Compare-at minor", "Currency minor unit"
    ]];
    let variantRowsTruncated = false;
    for (const product of products.slice(0, 5000)) {
      for (const variant of product.variants) {
        if (variantRows.length >= 25001) { variantRowsTruncated = true; break; }
        if (!variant.prices.length) {
          variantRows.push([product.name, variant.id, variant.sku, variant.barcode, variant.name, variant.isActive ? "Yes" : "No", variant.weightGrams, "", "", "", "", "", ""]);
        }
        for (const price of variant.prices) {
          if (variantRows.length >= 25001) { variantRowsTruncated = true; break; }
          variantRows.push([product.name, variant.id, variant.sku, variant.barcode, variant.name,
            variant.isActive ? "Yes" : "No", variant.weightGrams, price.market.code, price.market.name,
            price.currencyCode, price.amountMinor.toString(), price.compareAtMinor?.toString() ?? "",
            price.currency.minorUnit]);
        }
        if (variantRowsTruncated) break;
      }
      if (variantRowsTruncated) break;
    }

    const inventoryRows: Cell[][] = [[
      "Warehouse", "Warehouse code", "Warehouse active", "Product", "SKU", "Barcode",
      "Variant", "On hand", "Reserved", "Quarantined", "Reorder point", "Available (on hand - reserved - quarantined)", "Updated at"
    ], ...inventory.slice(0, 5000).map((row) => [
      row.warehouse.name, row.warehouse.code, row.warehouse.isActive ? "Yes" : "No",
      row.variant.product.name, row.variant.sku, row.variant.barcode, row.variant.name,
      row.quantityOnHand, row.quantityReserved, row.quantityQuarantined, row.reorderPoint,
      Math.max(0, row.quantityOnHand - row.quantityReserved - row.quantityQuarantined), row.updatedAt
    ])];

    const storeRows: Cell[][] = [
      ["Field", "Value"],
      ["Store ID", store.id], ["Store number", store.storeNumber.toString()], ["Store name", store.name],
      ["Store slug", store.slug], ["Store status", store.status], ["Description", store.description],
      ["Public phone", store.publicPhone], ["Public address", store.publicAddress],
      ["Seller legal name", store.seller.legalName], ["Seller display name", store.seller.displayName],
      ["Seller contact name", store.seller.contactName], ["Seller contact email", store.seller.contactEmail],
      ["Seller phone", store.seller.phoneNumber], ["Dispatch contact", store.shippingContactName],
      ["Dispatch phone", store.shippingPhone], ["Dispatch address line 1", store.shippingAddressLine1],
      ["Dispatch address line 2", store.shippingAddressLine2], ["Dispatch city", store.shippingCity],
      ["Dispatch region", store.shippingRegion], ["Dispatch postal code", store.shippingPostalCode],
      ["Dispatch country code", store.shippingCountryCode], ["Dispatch instructions", store.shippingInstructions],
      ["Created at", store.createdAt], ["Updated at", store.updatedAt],
      ["Export note", "Owner-only export. Buyer personal data, payment credentials and identity documents are intentionally excluded."],
      ["Product row limit", "Up to 5,000 products; the export is marked in the audit log if truncated."],
      ["Inventory row limit", "Up to 5,000 inventory records; the export is marked in the audit log if truncated."],
      ["Variant and price row limit", "Up to 25,000 variant/price rows; this sheet is truncated if that limit is reached."]
    ];

    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.store_export.downloaded",
        resource: "store", resourceId: store.id, scopeType: "STORE", scopeId: store.id,
        metadata: { productRows: Math.min(products.length, 5000), inventoryRows: Math.min(inventory.length, 5000), truncated: products.length > 5000 || inventory.length > 5000 || variantRowsTruncated }
      }
    });

    const xml = workbook([
      { name: "Store", rows: storeRows },
      { name: "Products", rows: productRows },
      { name: "Variants and prices", rows: variantRows },
      { name: "Inventory", rows: inventoryRows }
    ]);
    const filename = `matjar-${store.slug.replace(/[^a-zA-Z0-9_-]/g, "-")}-export.xls`;
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof MfaEnrollmentRequiredError || error instanceof MfaVerificationRequiredError) return Response.json({ error: "Additional account verification is required." }, { status: 403 });
    return Response.json({ error: "Unable to export this seller store." }, { status: 500 });
  }
}
