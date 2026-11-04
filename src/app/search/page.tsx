import type { Metadata } from "next";
import CatalogDiscoveryPage from "@/features/storefront/catalog-discovery-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search marketplace",
  description: "Search published products across active marketplace sellers."
};

type Props = { searchParams: Promise<{ q?: string; page?: string; categoryId?: string; brandId?: string; storeId?: string; marketId?: string; currencyCode?: string; minPrice?: string; maxPrice?: string; inStock?: string; sort?: string }> };

export default function SearchPage({ searchParams }: Props) {
  return <CatalogDiscoveryPage
    action="/search"
    heading="Search products"
    description="Search published products, identifiers, variants, brands, categories and active stores."
    searchParams={searchParams}
  />;
}
