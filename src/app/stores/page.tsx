import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoverableStores } from "@/server/marketplace/public-stores";
import CatalogListControls from "@/features/storefront/catalog-list-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stores", description: "Discover active stores from approved marketplace sellers." };

type Props = { searchParams: Promise<{ q?: string; page?: string }> };
export default async function StoresPage({ searchParams }: Props) {
  const search = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(search.page) || 1));
  const q = (search.q ?? "").trim().slice(0, 120);
  const result = await listDiscoverableStores({ page, limit: 24, q: q || undefined });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Independent commerce</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Discover stores</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">Explore active stores operated by approved sellers across the marketplace.</p>
    <CatalogListControls action="/stores" query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} label="Search stores" />
    {result.items.length ? <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.items.map((store) => <Link key={store.id} href={`/stores/${encodeURIComponent(store.slug)}`} className="rounded-2xl border border-[var(--border)] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{store.name}</h2>
        {store.sellerDisplayName && <p className="mt-1 text-sm text-[var(--muted)]">Seller: {store.sellerDisplayName}</p>}
        <p className="mt-2 text-sm text-[var(--muted)]">{store.productCount} published products</p>
        <span className="mt-5 inline-flex text-sm font-semibold text-[var(--color-forest-800)]">Visit store ↗</span>
      </Link>)}
    </div> : <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-sage-500)] bg-[var(--color-sage-100)]/50 px-6 py-14 text-center"><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">No active stores found</h2><p className="mt-2 text-sm text-[var(--muted)]">Try a different store name or clear the search.</p></div>}
    <CatalogListControls action="/stores" query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} label="Search stores" />
  </main>;
}
