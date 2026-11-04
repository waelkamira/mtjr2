import type { Metadata } from "next";
import CatalogDiscoveryPage from "@/features/storefront/catalog-discovery-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse products",
  description: "Browse published products across active marketplace sellers."
};

type Props = { searchParams: Promise<{ q?: string; page?: string; categoryId?: string; brandId?: string; storeId?: string; marketId?: string; currencyCode?: string; minPrice?: string; maxPrice?: string; inStock?: string; sort?: string }> };

export default function ProductsPage({ searchParams }: Props) {
  return <CatalogDiscoveryPage
    action="/products"
    heading="Browse products"
    description="Browse published products and filter by category, brand, store, market, currency, price, stock or keyword."
    searchParams={searchParams}
  />;
}
