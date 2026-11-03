"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type Currency = { code: string; name: string; symbol: string | null; minorUnit: number };
type Market = {
  id: string; code: string; name: string;
  defaultCurrency: Currency;
};
type Category = { id: string; slug: string; name: string; children: Category[] };
type ProductPrice = { marketId: string; currencyCode: string; amountMinor: string; compareAtMinor: string | null; currency: { minorUnit: number } };
type Product = {
  id: string; slug: string; name: string; description: string | null;
  brand: { name: string } | null; store: { name: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ id: string; prices: ProductPrice[] }>;
};
type PageResult<T> = { items: T[]; pagination: { total: number } };

function flattenCategories(items: Category[]): Category[] {
  return items.flatMap((item) => [item, ...flattenCategories(item.children ?? [])]);
}

function formatPrice(price: ProductPrice | undefined, markets: Market[]) {
  if (!price) return "Price unavailable";
  const currency = markets.flatMap((market) => [market.defaultCurrency]).find((item) => item.code === price.currencyCode);
  const minorUnit = price.currency.minorUnit ?? currency?.minorUnit ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: price.currencyCode }).format(
    Number(price.amountMinor) / (10 ** minorUnit)
  );
}

export default function StorefrontHomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [marketId, setMarketId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [loadingReference, setLoadingReference] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/markets").then(async (response) => {
        if (!response.ok) throw new Error("Markets could not be loaded.");
        return response.json() as Promise<PageResult<Market>>;
      }),
      fetch("/api/categories?locale=en&limit=30").then(async (response) => {
        if (!response.ok) throw new Error("Categories could not be loaded.");
        return response.json() as Promise<PageResult<Category>>;
      })
    ]).then(([marketResult, categoryResult]) => {
      if (!active) return;
      setMarkets(marketResult.items);
      setCategories(categoryResult.items);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Marketplace data is unavailable.");
    }).finally(() => {
      if (active) setLoadingReference(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ locale: "en", limit: "24" });
    if (marketId) {
      params.set("marketId", marketId);
      const currency = markets.find((market) => market.id === marketId)?.defaultCurrency.code;
      if (currency) params.set("currencyCode", currency);
    }
    if (categoryId) params.set("categoryId", categoryId);
    if (query) params.set("q", query);
    setLoadingProducts(true);
    fetch(`/api/products?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Products could not be loaded.");
        return response.json() as Promise<PageResult<Product>>;
      })
      .then((result) => { if (active) setProducts(result.items); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Products are unavailable.");
      })
      .finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, [marketId, categoryId, query, markets]);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const selectedMarket = markets.find((market) => market.id === marketId);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim());
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-[var(--border)] bg-[var(--color-forest-950)] text-center text-xs tracking-wide text-white/85">
        A considered marketplace for the things worth keeping
      </div>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--color-ivory-50)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-5 py-4 lg:px-10">
          <Link href="/" className="mr-2 text-2xl font-semibold tracking-tight text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <form onSubmit={submitSearch} className="order-3 flex w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white md:order-none md:ml-5 md:max-w-xl md:flex-1">
            <input aria-label="Search products" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search products, brands and more" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" />
            <button className="bg-[var(--color-forest-800)] px-5 text-sm font-medium text-white transition hover:bg-[var(--color-forest-950)]" type="submit">Search</button>
          </form>
          <label className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>Ship to</span>
            <select aria-label="Choose market" value={marketId} onChange={(event) => setMarketId(event.target.value)} className="max-w-40 rounded-lg border border-[var(--border)] bg-white px-2 py-2 text-sm text-[var(--foreground)]">
              <option value="">All markets</option>
              {markets.map((market) => <option key={market.id} value={market.id}>{market.name} · {market.defaultCurrency.code}</option>)}
            </select>
          </label>
        </div>
        <nav aria-label="Main navigation" className="mx-auto flex max-w-[1440px] gap-7 overflow-x-auto px-5 pb-3 text-sm text-[var(--color-ink-700)] lg:px-10">
          <a href="#discover" className="whitespace-nowrap font-medium text-[var(--color-forest-800)]">Discover</a>
          <a href="#categories" className="whitespace-nowrap">Categories</a>
          <a href="#about" className="whitespace-nowrap">Our marketplace</a>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 lg:grid-cols-[1.15fr_.85fr] lg:px-10 lg:py-16">
        <div className="flex flex-col justify-center rounded-[2rem] bg-[var(--color-forest-950)] px-8 py-12 text-white sm:px-12 lg:min-h-[390px]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.24em] text-[var(--color-sage-300)]">The world, thoughtfully curated</p>
          <h1 className="max-w-2xl text-4xl font-medium leading-[1.12] tracking-tight sm:text-6xl">Find something <span className="font-serif italic text-[var(--color-sage-300)]">exceptional.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/75">Discover independent stores and considered collections from a marketplace built to bring the world closer.</p>
          <a href="#discover" className="mt-8 inline-flex w-fit items-center rounded-xl bg-[var(--color-ivory-50)] px-5 py-3 text-sm font-semibold text-[var(--color-forest-950)] transition hover:bg-[var(--color-sage-100)]">Explore the collection <span aria-hidden="true" className="ml-3">↗</span></a>
        </div>
        <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--color-sage-100)] p-8 sm:p-10">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[var(--color-sage-500)]/40" />
          <div className="absolute -right-2 top-12 h-44 w-44 rounded-full border border-[var(--color-sage-500)]/40" />
          <p className="relative text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-forest-800)]">A world of independent commerce</p>
          <div className="relative">
            <p className="font-serif text-3xl leading-tight text-[var(--color-forest-950)] sm:text-4xl">Distinctive finds.<br />Trusted sellers.</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--color-ink-700)]">A growing collection of products, makers and stores — all in one place.</p>
          </div>
          <span className="relative text-xs tracking-widest text-[var(--color-forest-800)]">MTJR / GLOBAL MARKETPLACE</span>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10">
        <div className="mb-5 flex items-end justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Explore by interest</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Browse categories</h2></div>
          <button type="button" onClick={() => setCategoryId("")} className="text-sm text-[var(--color-forest-800)] underline underline-offset-4">View all</button>
        </div>
        {loadingReference ? <p className="text-sm text-[var(--muted)]">Loading categories…</p> : flatCategories.length ? (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {flatCategories.map((category) => <button key={category.id} type="button" onClick={() => setCategoryId(category.id === categoryId ? "" : category.id)} className={`whitespace-nowrap rounded-xl border px-5 py-3 text-sm transition ${categoryId === category.id ? "border-[var(--color-forest-800)] bg-[var(--color-forest-800)] text-white" : "border-[var(--border)] bg-white text-[var(--color-ink-700)] hover:border-[var(--color-sage-500)]"}`}>{category.name}</button>)}
          </div>
        ) : <p className="rounded-xl bg-[var(--color-ivory-100)] px-5 py-4 text-sm text-[var(--muted)]">Categories will appear here as the marketplace catalog is activated.</p>}
      </section>

      <section id="discover" className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Selected for discovery</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Explore the marketplace</h2><p className="mt-2 text-sm text-[var(--muted)]">{selectedMarket ? `Prices for ${selectedMarket.name} · ${selectedMarket.defaultCurrency.code}` : "Discover products from active stores"}</p></div>
          {(query || categoryId) && <button type="button" onClick={() => { setQuery(""); setDraftQuery(""); setCategoryId(""); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Clear filters</button>}
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {loadingProducts ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" />)}</div> : products.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const price = product.variants.flatMap((variant) => variant.prices).find((item) => !marketId || item.marketId === marketId);
              const image = product.media[0];
              return <Link key={product.id} href={`/products/${encodeURIComponent(product.slug)}`} className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
                <div className="relative aspect-[4/4.6] overflow-hidden bg-[var(--color-ivory-100)]">
                  {image ? <img src={image.url} alt={image.altText ?? product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-xs uppercase tracking-[.2em] text-[var(--color-sage-600)]">Mtjr collection</div>}
                </div>
                <div className="p-4">
                  <p className="truncate text-[11px] uppercase tracking-wider text-[var(--muted)]">{product.brand?.name ?? product.store.name}</p>
                  <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5">{product.name}</h3>
                  <p className="mt-4 text-lg font-semibold text-[var(--color-forest-950)]">{formatPrice(price, markets)}</p>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">Sold by {product.store.name}</p>
                </div>
              </Link>;
            })}
          </div>
        ) : <div className="rounded-2xl border border-dashed border-[var(--color-sage-500)] bg-[var(--color-sage-100)]/50 px-6 py-14 text-center"><h3 className="text-lg font-semibold">The collection is taking shape</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{query || categoryId ? "No active products match these filters. Try another search or clear the filters." : "Products from approved and active stores will appear here once the catalog is published."}</p></div>}
      </section>

      <footer id="about" className="mt-10 bg-[var(--color-forest-950)] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-10 text-sm text-white/70 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <span className="text-xl font-semibold tracking-tight text-white">mtjr<span className="text-[var(--color-copper-500)]">.</span></span>
          <p>A global marketplace built around discovery, trust and independent stores.</p>
          <span>© {new Date().getFullYear()} Mtjr</span>
        </div>
      </footer>
    </main>
  );
}
