import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDiscoverableStoreBySlug } from "@/server/marketplace/public-stores";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";

<<<<<<< HEAD
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; page?: string; sort?: string }> };
=======
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; page?: string }> };
>>>>>>> 442aae41dfb67a4b1bc8871948cab095bcdb9ade
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getDiscoverableStoreBySlug(slug);
  return store ? { title: store.name, description: `Browse published products from ${store.name} on Mtjr.`, alternates: { canonical: `/stores/${encodeURIComponent(store.slug)}` } } : { title: "Store not found", robots: { index: false, follow: false } };
}
export default async function StoreDetailPage({ params, searchParams }: Props) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const store = await getDiscoverableStoreBySlug(slug);
  if (!store) notFound();
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  const q = (search.q ?? "").trim().slice(0, 120);
<<<<<<< HEAD
  const sort = search.sort === "name_asc" || search.sort === "name_desc" ? search.sort : "newest";
  const result = await listDiscoverableProducts({ storeId: store.id, q: q || undefined, page, limit: 24, sort });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Verified marketplace seller</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{store.name}</h1>
    {store.sellerDisplayName && <p className="mt-2 text-sm text-[var(--muted)]">Operated by {store.sellerDisplayName}</p>}
    <p className="mt-3 text-sm text-[var(--muted)]">{result.pagination.total} published products</p>
    <CatalogListControls action={`/stores/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} />
    <CatalogProductGrid products={result.items} />
    <CatalogListControls action={`/stores/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} />
=======
  const result = await listDiscoverableProducts({ storeId: store.id, q: q || undefined, page, limit: 24 });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Verified marketplace seller</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{store.name}</h1>
    <p className="mt-3 text-sm text-[var(--muted)]">{result.pagination.total} published products</p>
    <CatalogListControls action={`/stores/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} />
    <CatalogProductGrid products={result.items} />
    <CatalogListControls action={`/stores/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} />
>>>>>>> 442aae41dfb67a4b1bc8871948cab095bcdb9ade
  </main>;
}
