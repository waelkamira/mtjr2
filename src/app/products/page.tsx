import type { Metadata } from "next";
import CatalogDiscoveryPage from "@/features/storefront/catalog-discovery-page";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Browse products", "تصفّح المنتجات"),
    description: translate(locale, "Browse published products across active marketplace sellers.", "تصفّح المنتجات المنشورة لدى البائعين النشطين في السوق.")
  };
}

type Props = { searchParams: Promise<{ q?: string; page?: string; categoryId?: string; brandId?: string; storeId?: string; marketId?: string; currencyCode?: string; minPrice?: string; maxPrice?: string; inStock?: string; sort?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const locale = await getPreferredLocale();
  return <CatalogDiscoveryPage
    action="/products"
    heading={translate(locale, "Browse products", "تصفّح المنتجات")}
    description={translate(locale, "Browse published products and filter by category, brand, store, market, currency, price, stock or keyword.", "تصفّح المنتجات المنشورة وصفِّها حسب الفئة أو العلامة التجارية أو المتجر أو السوق أو العملة أو السعر أو المخزون أو كلمة البحث.")}
    searchParams={searchParams}
  />;
}
