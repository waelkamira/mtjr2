import { listDiscoverableProducts } from "@/server/catalog/discovery";
import { listActiveBrands, listActiveCategoryTree } from "@/server/catalog/taxonomy";
import { listDiscoverableStores } from "@/server/marketplace/public-stores";
import { listActiveMarkets } from "@/server/marketplace/market-query";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";

type SearchParams = {
  q?: string;
  page?: string;
  categoryId?: string;
  brandId?: string;
  storeId?: string;
  marketId?: string;
  currencyCode?: string;
  sort?: string;
};

type Props = {
  searchParams: Promise<SearchParams>;
  action: string;
  heading: string;
  description: string;
};

type CategoryTree = Awaited<ReturnType<typeof listActiveCategoryTree>>["items"];

function categoryOptions(items: CategoryTree, prefix = ""): Array<{ id: string; name: string }> {
  return items.flatMap((item) => [
    { id: item.id, name: prefix + item.name },
    ...categoryOptions(item.children, `${prefix}${item.name} / `)
  ]);
}

export default async function CatalogDiscoveryPage({ searchParams, action, heading, description }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const categoryId = params.categoryId?.trim() || undefined;
  const brandId = params.brandId?.trim() || undefined;
  const storeId = params.storeId?.trim() || undefined;
  const marketId = params.marketId?.trim() || undefined;
  const currencyCode = marketId ? params.currencyCode?.trim().toUpperCase() || undefined : undefined;
  const sort = params.sort === "name_asc" || params.sort === "name_desc" ? params.sort : "newest";
  const [result, categories, brands, stores, markets] = await Promise.all([
    listDiscoverableProducts({ q: q || undefined, page, limit: 24, categoryId, brandId, storeId, marketId, currencyCode, sort }),
    listActiveCategoryTree({ page: 1, limit: 100 }),
    listActiveBrands({ page: 1, limit: 100 }),
    listDiscoverableStores({ page: 1, limit: 100 }),
    listActiveMarkets()
  ]);
  const selectedMarket = markets.find((market) => market.id === marketId);
  const filters = {
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(marketId ? { marketId } : {}),
    ...(currencyCode ? { currencyCode } : {}),
    ...(sort !== "newest" ? { sort } : {})
  };

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Marketplace discovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{heading}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{description}</p>
      <form action={action} method="get" className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-medium sm:col-span-2">Keywords<input name="q" maxLength={120} defaultValue={q} placeholder="Name, SKU, barcode, brand or store" className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm" /></label>
        <label className="grid gap-1 text-xs font-medium">Category<select name="categoryId" defaultValue={categoryId ?? ""} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"><option value="">All categories</option>{categoryOptions(categories.items).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">Brand<select name="brandId" defaultValue={brandId ?? ""} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"><option value="">All brands</option>{brands.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">Store / vendor<select name="storeId" defaultValue={storeId ?? ""} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"><option value="">All stores</option>{stores.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sellerDisplayName ? ` — ${item.sellerDisplayName}` : ""}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">Market<select name="marketId" defaultValue={marketId ?? ""} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"><option value="">All active markets</option>{markets.map((market) => <option key={market.id} value={market.id}>{market.name} · {market.country.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">Currency<select name="currencyCode" defaultValue={currencyCode ?? ""} disabled={!selectedMarket} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm disabled:bg-gray-100"><option value="">All enabled currencies</option>{selectedMarket?.currencies.map(({ currency }) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">Sort by<select name="sort" defaultValue={sort} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"><option value="newest">Newest</option><option value="name_asc">Name: A to Z</option><option value="name_desc">Name: Z to A</option></select></label>
        <div className="flex items-end gap-2"><button type="submit" className="rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white">Apply filters</button><a href={action} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm">Clear</a></div>
      </form>
      <div className="mt-7 flex items-center justify-between text-sm text-[var(--muted)]"><span>{result.pagination.total} matching products</span>{q && <span>Query: “{q}”</span>}</div>
      <CatalogListControls action={action} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} params={filters} />
      <CatalogProductGrid products={result.items} />
      <CatalogListControls action={action} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} params={filters} />
    </main>
  );
}
