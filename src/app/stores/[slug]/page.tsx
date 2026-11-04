import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDiscoverableStoreBySlug } from "@/server/marketplace/public-stores";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getDiscoverableStoreBySlug(slug);
  return store ? { title: store.name, description: `Browse published products from ${store.name} on Mtjr.`, alternates: { canonical: `/stores/${encodeURIComponent(store.slug)}` } } : { title: "Store not found", robots: { index: false, follow: false } };
}
export default async function StoreDetailPage({ params }: Props) {
  const { slug } = await params;
  const store = await getDiscoverableStoreBySlug(slug);
  if (!store) notFound();
  const result = await listDiscoverableProducts({ storeId: store.id, page: 1, limit: 48 });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Verified marketplace seller</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{store.name}</h1>
    <p className="mt-3 text-sm text-[var(--muted)]">{result.pagination.total} published products</p>
    <CatalogProductGrid products={result.items} />
  </main>;
}
