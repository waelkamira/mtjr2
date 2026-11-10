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

const PRODUCT_LIMIT = 5_000;
const INVENTORY_LIMIT = 5_000;
const VARIANT_PRICE_LIMIT = 25_000;

function xmlEscape(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
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

    // Each collection is bounded at the database query, not after loading unbounded nested relations.
    const products = await prisma.product.findMany({
      where: { storeId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: PRODUCT_LIMIT + 1,
      select: {
        id: true, productNumber: true, name: true, slug: true, description: true, status: true,
        approvalStatus: true, city: true, district: true, streetAddress: true,
        createdAt: true, updatedAt: true
      }
    });
    const exportedProducts = products.slice(0, PRODUCT_LIMIT);
    const productIds = exportedProducts.map((product) => product.id);

    const [variants, inventory] = await Promise.all([
      productIds.length
        ? prisma.productVariant.findMany({
            where: { productId: { in: productIds } },
            orderBy: [{ productId: "asc" }, { sku: "asc" }, { id: "asc" }],
            take: VARIANT_PRICE_LIMIT + 1,
            select: {
              id: true, productId: true, sku: true, barcode: true, name: true,
              isActive: true, weightGrams: true,
              product: { select: { name: true } }
            }
          })
        : Promise.resolve([]),
      prisma.inventory.findMany({
        where: {
          warehouse: { is: { storeId } },
          // Defense in depth: inventory must belong to a variant whose product is in this same store.
          variant: { is: { product: { is: { storeId } } } }
        },
        orderBy: [{ warehouse: { name: "asc" } }, { id: "asc" }],
        take: INVENTORY_LIMIT + 1,
        select: {
          quantityOnHand: true, quantityReserved: true, quantityQuarantined: true,
          reorderPoint: true, updatedAt: true,
          warehouse: { select: { code: true, name: true, isActive: true } },
          variant: {
            select: {
              sku: true, barcode: true, name: true,
              product: { select: { id: true, name: true, storeId: true } }
            }
          }
        }
      })
    ]);

    const exportedVariants = variants.slice(0, VARIANT_PRICE_LIMIT);
    const variantIds = exportedVariants.map((variant) => variant.id);
    const prices = variantIds.length
      ? await prisma.productPrice.findMany({
          where: { variantId: { in: variantIds } },
          orderBy: [{ variantId: "asc" }, { marketId: "asc" }, { currencyCode: "asc" }],
          take: VARIANT_PRICE_LIMIT + 1,
          select: {
            variantId: true, currencyCode: true, amountMinor: true, compareAtMinor: true,
            market: { select: { code: true, name: true } },
            currency: { select: { minorUnit: true } }
          }
        })
      : [];

    const pricesByVariant = new Map<string, typeof prices>();
    for (const price of prices.slice(0, VARIANT_PRICE_LIMIT)) {
      const rows = pricesByVariant.get(price.variantId) ?? [];
      rows.push(price);
      pricesByVariant.set(price.variantId, rows);
    }

    const productRows: Cell[][] = [[
      "Product ID", "Product number", "Name", "Slug", "Description", "Status",
      "Approval status", "City", "District", "Street address", "Created at", "Updated at"
    ], ...exportedProducts.map((product) => [
      product.id, product.productNumber.toString(), product.name, product.slug, product.description,
      product.status, product.approvalStatus, product.city, product.district, product.streetAddress,
      product.createdAt, product.updatedAt
    ])];

    const variantRows: Cell[][] = [[
      "Product", "Variant ID", "SKU", "Barcode", "Variant name", "Active", "Weight grams",
      "Market code", "Market", "Currency", "Amount minor", "Compare-at minor", "Currency minor unit"
    ]];
    let variantRowsTruncated = variants.length > VARIANT_PRICE_LIMIT || prices.length > VARIANT_PRICE_LIMIT;
    for (const variant of exportedVariants) {
      const variantPrices = pricesByVariant.get(variant.id) ?? [];
      const rows = variantPrices.length ? variantPrices : [null];
      for (const price of rows) {
        if (variantRows.length > VARIANT_PRICE_LIMIT) {
          variantRowsTruncated = true;
          break;
        }
        variantRows.push([
          variant.product.name, variant.id, variant.sku, variant.barcode, variant.name,
          variant.isActive ? "Yes" : "No", variant.weightGrams,
          price?.market.code ?? "", price?.market.name ?? "", price?.currencyCode ?? "",
          price?.amountMinor.toString() ?? "", price?.compareAtMinor?.toString() ?? "",
          price?.currency.minorUnit ?? ""
        ]);
      }
      if (variantRowsTruncated && variantRows.length > VARIANT_PRICE_LIMIT) break;
    }

    const exportedInventory = inventory.slice(0, INVENTORY_LIMIT);
    const inventoryRows: Cell[][] = [[
      "Warehouse", "Warehouse code", "Warehouse active", "Product", "SKU", "Barcode",
      "Variant", "On hand", "Reserved", "Quarantined", "Reorder point",
      "Available (on hand - reserved - quarantined)", "Updated at"
    ], ...exportedInventory.map((row) => [
      row.warehouse.name, row.warehouse.code, row.warehouse.isActive ? "Yes" : "No",
      row.variant.product.name, row.variant.sku, row.variant.barcode, row.variant.name,
      row.quantityOnHand, row.quantityReserved, row.quantityQuarantined, row.reorderPoint,
      Math.max(0, row.quantityOnHand - row.quantityReserved - row.quantityQuarantined), row.updatedAt
    ])];

    const truncated = products.length > PRODUCT_LIMIT || inventory.length > INVENTORY_LIMIT || variantRowsTruncated;
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
      ["Export truncated", truncated ? "Yes" : "No"],
      ["Limits", "5,000 products; 5,000 inventory records; 25,000 variants/prices rows."]
    ];

    await prisma.auditLog.create({
      data: {
        actorType: AuditActorType.USER, actorId: actor.userId, action: "seller.store_export.downloaded",
        resource: "store", resourceId: store.id, scopeType: "STORE", scopeId: store.id,
        metadata: {
          productRows: exportedProducts.length,
          inventoryRows: exportedInventory.length,
          variantRows: variantRows.length - 1,
          truncated
        }
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
