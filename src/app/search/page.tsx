import type { Metadata } from "next";
import CatalogDiscoveryPage from "@/features/storefront/catalog-discovery-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Search marketplace", "ابحث في السوق"),
    description: translate(locale, "Search published products across active marketplace sellers.", "ابحث عن المنتجات المنشورة لدى البائعين النشطين في السوق.")
  };
}

type Props = { searchParams: Promise<{ q?: string; page?: string; categoryId?: string; brandId?: string; storeId?: string; marketId?: string; currencyCode?: string; minPrice?: string; maxPrice?: string; inStock?: string; sort?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const locale = await getPreferredLocale();
  return <CatalogDiscoveryPage
    action="/search"
    heading={translate(locale, "Search products", "ابحث عن المنتجات")}
    description={translate(locale, "Search published products, identifiers, variants, brands, categories and active stores.", "ابحث عن المنتجات المنشورة ومعرّفاتها ومتغيراتها وعلاماتها التجارية وفئاتها ومتاجرها النشطة.")}
    searchParams={searchParams}
  />;
}
