"use client";

import { formatMinorUnits } from "@/lib/money";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Currency = { code: string; name: string; symbol: string | null; minorUnit: number };
type Market = {
  id: string; code: string; name: string;
  defaultCurrency: Currency;
};
type Category = { id: string; slug: string; name: string; imageUrl: string | null; children: Category[] };
type Brand = { id: string; slug: string; name: string };
type ProductPrice = { marketId: string; currencyCode: string; amountMinor: string; compareAtMinor: string | null; currency: { minorUnit: number } };
type Product = {
  id: string; slug: string; name: string; description: string | null;
  brand: { name: string } | null; store: { name: string };
  media: Array<{ url: string; altText: string | null; isPrimary: boolean }>;
  variants: Array<{ id: string; prices: ProductPrice[] }>;
};
type PageResult<T> = { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

function flattenCategories(items: Category[]): Category[] {
  return items.flatMap((item) => [item, ...flattenCategories(item.children ?? [])]);
}

function formatPrice(price: ProductPrice | undefined, markets: Market[], locale: "ar" | "en") {
  if (!price) return translate(locale, "Price unavailable", "السعر غير متاح");
  const currency = markets.flatMap((market) => [market.defaultCurrency]).find((item) => item.code === price.currencyCode);
  const minorUnit = price.currency.minorUnit ?? currency?.minorUnit ?? 2;
  return formatMinorUnits(price.amountMinor, price.currencyCode, minorUnit, locale);
}

export default function StorefrontHomePage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [marketId, setMarketId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "name_asc" | "name_desc">("newest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loadingReference, setLoadingReference] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");
  const [urlReady, setUrlReady] = useState(false);

  // Restore shareable discovery state before the first catalog request.
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedSort = params.get("sort");
      const requestedPage = Number(params.get("page") ?? "1");
      setQuery((params.get("q") ?? "").slice(0, 120));
      setDraftQuery((params.get("q") ?? "").slice(0, 120));
      setCategoryId(params.get("categoryId") ?? "");
      setBrandId(params.get("brandId") ?? "");
      setSort(requestedSort === "name_asc" || requestedSort === "name_desc" ? requestedSort : "newest");
      setPage(Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1);
      setUrlReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  // Keep the active discovery filters in the URL so searches can be shared or reloaded.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (categoryId) params.set("categoryId", categoryId);
    if (brandId) params.set("brandId", brandId);
    if (sort !== "newest") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [urlReady, query, categoryId, brandId, sort, page]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/markets").then(async (response) => {
        if (!response.ok) throw new Error(t("Markets could not be loaded.", "تعذّر تحميل الأسواق."));
        return response.json() as Promise<PageResult<Market>>;
      }),
      fetch(`/api/categories?locale=${locale}&limit=30`).then(async (response) => {
        if (!response.ok) throw new Error(t("Categories could not be loaded.", "تعذّر تحميل الفئات."));
        return response.json() as Promise<PageResult<Category>>;
      }),
      fetch(`/api/brands?locale=${locale}&limit=100`).then(async (response) => {
        if (!response.ok) throw new Error(t("Brands could not be loaded.", "تعذّر تحميل العلامات التجارية."));
        return response.json() as Promise<PageResult<Brand>>;
      })
    ]).then(([marketResult, categoryResult, brandResult]) => {
      if (!active) return;
      setMarkets(marketResult.items);
      setMarketId(marketResult.items.find((market) => market.code === "SY-SYR")?.id ?? "");
      setCategories(categoryResult.items);
      setBrands(brandResult.items);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : t("Marketplace data is unavailable.", "بيانات السوق غير متاحة."));
    }).finally(() => {
      if (active) setLoadingReference(false);
    });
    return () => { active = false; };
  }, [locale, t]);

  useEffect(() => {
    if (!urlReady) return;
    let active = true;
    const params = new URLSearchParams({ locale, limit: "24", page: String(page), sort });
    if (marketId) {
      params.set("marketId", marketId);
      const currency = markets.find((market) => market.id === marketId)?.defaultCurrency.code;
      if (currency) params.set("currencyCode", currency);
    }
    if (categoryId) params.set("categoryId", categoryId);
    if (brandId) params.set("brandId", brandId);
    if (query) params.set("q", query);
    Promise.resolve().then(() => { if (active) setLoadingProducts(true); });
    fetch(`/api/products?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(t("Products could not be loaded.", "تعذّر تحميل المنتجات."));
        return response.json() as Promise<PageResult<Product>>;
      })
      .then((result) => { if (active) { setProducts(result.items); setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages }); } })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("Products are unavailable.", "المنتجات غير متاحة."));
      })
      .finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, [urlReady, marketId, categoryId, brandId, query, markets, sort, page, locale, t]);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const selectedMarket = markets.find((market) => market.id === marketId);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim());
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-transparent">
      <div className="border-y border-white/70 bg-[var(--color-lavender-100)] py-2 text-center text-xs font-semibold tracking-wide text-[var(--color-lavender-800)]">
        {t("A considered marketplace for the things worth keeping", "سوقٌ مختار بعناية للأشياء التي تستحق الاحتفاظ بها")}
      </div>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-3 py-6 sm:px-5 sm:py-10 lg:grid-cols-[1.15fr_.85fr] lg:px-10 lg:py-16">
        <div className="clay-surface flex flex-col justify-center rounded-[2.25rem] border-white/80 bg-[var(--color-lavender-100)] px-8 py-12 text-[var(--color-lavender-950)] sm:px-12 lg:min-h-[390px]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.24em] text-[var(--color-lavender-800)]">{t("The world, thoughtfully curated", "العالم، منتقى بعناية")}</p>
          <h1 className="max-w-2xl text-4xl font-medium leading-[1.12] tracking-tight sm:text-6xl">{t("Find something", "اعثر على شيء")} <span className="font-serif italic text-[var(--color-lavender-800)]">{t("exceptional.", "استثنائي.")}</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[var(--color-lavender-800)]/80">{t("Discover independent stores and considered collections from a marketplace built to bring the world closer.", "اكتشف متاجر مستقلة ومجموعات مختارة بعناية في سوق يقرّب العالم.")}</p>
          <a href="#discover" className="mt-8 inline-flex w-fit items-center clay-interactive rounded-2xl border border-[var(--color-orange)] bg-[var(--action)] px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-clay)] transition hover:bg-[var(--action-hover)]">{t("Explore the collection", "استكشف المجموعة")} <span aria-hidden="true" className="ml-3">↗</span></a>
        </div>
        <div className="clay-surface relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[2.25rem] border-white/80 bg-[var(--color-mint-100)] p-8 sm:p-10">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[var(--color-sage-500)]/40" />
          <div className="absolute -right-2 top-12 h-44 w-44 rounded-full border border-[var(--color-sage-500)]/40" />
          <p className="relative text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-mint-800)]">{t("A world of independent commerce", "عالم من التجارة المستقلة")}</p>
          <div className="relative">
            <p className="font-serif text-3xl leading-tight text-[var(--color-mint-800)] sm:text-4xl">{t("Distinctive finds.", "اكتشافات مميزة.")}<br />{t("Trusted sellers.", "بائعون موثوقون.")}</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--color-mint-800)]/80">{t("A growing collection of products, makers and stores — all in one place.", "مجموعة متنامية من المنتجات والصنّاع والمتاجر — في مكان واحد.")}</p>
          </div>
          <span className="relative text-xs tracking-widest text-[var(--color-mint-800)]">MTJR / {t("GLOBAL MARKETPLACE", "السوق العالمي")}</span>
        </div>
      </section>

      <section aria-labelledby="editorial-heading" className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
        <div className="clay-surface overflow-hidden rounded-[2rem] border-white/80 bg-[var(--surface)]">
          <div className="grid lg:grid-cols-[.85fr_1.15fr]">
            <div className="flex flex-col justify-center bg-[var(--color-blush-100)] p-7 sm:p-10 lg:p-12">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[var(--color-blush-800)]">{t("A better way to discover", "طريقة أفضل للاكتشاف")}</p>
              <h2 id="editorial-heading" className="mt-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-[var(--color-lavender-950)] sm:text-4xl">{t("Good things come from looking a little closer.", "الأشياء الجميلة تبدأ بنظرة أقرب.")}</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-[var(--color-ink-700)]">{t("Explore independent stores, discover new brands and find pieces that feel like they were chosen just for you.", "استكشف المتاجر المستقلة والعلامات التجارية الجديدة واعثر على قطع تبدو وكأنها اختيرت لك.")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#discover" className="inline-flex items-center clay-interactive rounded-2xl border border-white/70 bg-[var(--action)] px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-clay)] transition-colors hover:border-[var(--action-hover)] hover:bg-[var(--action-hover)] hover:text-white">{t("Browse products", "تصفّح المنتجات")} <span aria-hidden="true" className="ml-3">↗</span></a>

                <Link href="/seller" className="inline-flex items-center clay-interactive rounded-2xl border border-white/80 bg-white/70 px-5 py-3 text-sm font-bold text-[var(--color-lavender-800)] shadow-[var(--shadow-clay)] transition hover:bg-white">{t("Meet the sellers", "تعرّف على البائعين")}</Link>
              </div>
            </div>
            <div className="grid min-h-[340px] grid-cols-2 gap-3 bg-[var(--color-lavender-50)] p-3 sm:gap-4 sm:p-5">
              <a href="#categories" className="group relative flex min-h-40 flex-col justify-end overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] transition hover:shadow-[var(--shadow-card)] sm:min-h-64 sm:p-7">
                <span className="absolute -right-8 -top-8 h-36 w-36 rounded-full border border-[var(--border)] transition duration-500 group-hover:scale-110 sm:h-52 sm:w-52" />
                <span className="absolute right-5 top-5 font-serif text-5xl text-[var(--color-copper-600)]/30 sm:right-8 sm:top-8 sm:text-7xl">01</span>
                <span className="relative text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Explore", "استكشف")}</span>
                <span className="relative mt-2 text-xl font-semibold sm:text-2xl">{t("Everyday finds", "اكتشافات يومية")}</span>
                <span className="relative mt-2 text-xs leading-5 text-[var(--color-ink-700)]/80">{t("Useful things, thoughtfully chosen", "أشياء مفيدة مختارة بعناية")}</span>
              </a>
              <a href="#discover" className="group relative mt-8 flex min-h-40 flex-col justify-end overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--color-ivory-50)] p-5 transition hover:shadow-[var(--shadow-card)] sm:mt-12 sm:min-h-64 sm:p-7">
                <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-[var(--color-copper-600)]/30 transition duration-500 group-hover:scale-110 sm:h-56 sm:w-56" />
                <span className="absolute right-5 top-5 font-serif text-5xl text-[var(--color-copper-600)]/30 sm:right-8 sm:top-8 sm:text-7xl">02</span>
                <span className="relative text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Discover", "اكتشف")}</span>
                <span className="relative mt-2 text-xl font-semibold text-[var(--color-forest-950)] sm:text-2xl">{t("New perspectives", "آفاق جديدة")}</span>
                <span className="relative mt-2 text-xs leading-5 text-[var(--color-ink-700)]">{t("Meet the stores behind the products", "تعرّف على المتاجر وراء المنتجات")}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10">
        <div className="mb-5 flex items-end justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Explore by interest", "استكشف حسب اهتماماتك")}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{t("Browse categories", "تصفّح الفئات")}</h2></div>
          <Link href="/categories" className="text-sm text-[var(--color-forest-800)] underline underline-offset-4">{t("View all", "عرض الكل")}</Link>
        </div>
        {loadingReference ? <p className="text-sm text-[var(--muted)]">{t("Loading categories…", "جارٍ تحميل الفئات…")}</p> : flatCategories.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {flatCategories.map((category) => <button key={category.id} type="button" onClick={() => { setCategoryId(category.id === categoryId ? "" : category.id); setPage(1); document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" }); }} aria-pressed={categoryId === category.id} className={`group relative min-h-40 overflow-hidden rounded-2xl border text-left transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card)] ${categoryId === category.id ? "border-[var(--color-forest-800)] ring-2 ring-[var(--color-forest-800)]" : "border-[var(--border)]"}`}>

              {category.imageUrl && <img src={category.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              <span className="absolute inset-0 bg-gradient-to-t from-[var(--color-forest-950)]/90 via-[var(--color-forest-950)]/20 to-transparent" />
              <span className="absolute bottom-0 left-0 right-0 p-4 text-base font-semibold text-white">{category.name}<span className="ml-2 text-[var(--color-sage-200)]" aria-hidden="true">↗</span></span>
            </button>)}
          </div>
        ) : <p className="rounded-xl bg-[var(--color-ivory-100)] px-5 py-4 text-sm text-[var(--muted)]">{t("Categories will appear here as the marketplace catalog is activated.", "ستظهر الفئات هنا عند تفعيل كتالوج السوق.")}</p>}
      </section>

      {brands.length > 0 && <section id="brands" aria-label={t("Featured brands", "علامات تجارية مميزة")} className="mx-auto max-w-[1440px] px-5 py-5 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-white px-5 py-5">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Independent labels", "علامات تجارية مستقلة")}</p><h2 className="mt-1 text-xl font-bold text-[var(--color-lavender-950)]">{t("Discover the brands", "اكتشف العلامات التجارية")}</h2></div>
          <div className="flex flex-wrap gap-2">
            {brands.slice(0, 8).map((brand) => <button key={brand.id} type="button" onClick={() => { setBrandId(brand.id === brandId ? "" : brand.id); setPage(1); document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" }); }} aria-pressed={brandId === brand.id} className={`rounded-full border px-4 py-2 text-sm transition ${brandId === brand.id ? "border-[var(--color-forest-800)] bg-[var(--color-forest-800)] text-white" : "border-[var(--border)] text-[var(--color-ink-700)] hover:border-[var(--color-sage-500)]"}`}>{brand.name}</button>)}

          </div>
        </div>
      </section>}

      <section id="discover" className="mx-auto max-w-[1440px] px-3 py-6 sm:px-5 sm:py-10 lg:px-10 lg:py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Selected for discovery", "مختار للاكتشاف")}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{t("Explore the marketplace", "استكشف السوق")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{selectedMarket ? `${t("Prices for", "الأسعار في")} ${selectedMarket.name} · ${selectedMarket.defaultCurrency.code}` : t("Discover products from active stores", "اكتشف منتجات المتاجر النشطة")}</p></div>
          <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-[var(--muted)]">{t("Brand", "العلامة التجارية")} <select aria-label={t("Filter by brand", "تصفية حسب العلامة التجارية")} value={brandId} onChange={(event) => { setBrandId(event.target.value); setPage(1); }} className="ml-2 max-w-44 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="">{t("All brands", "كل العلامات التجارية")}</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-sm text-[var(--muted)]">{t("Sort by", "ترتيب حسب")} <select aria-label={t("Sort products", "ترتيب المنتجات")} value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} className="ml-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"><option value="newest">{t("Newest", "الأحدث")}</option><option value="name_asc">{t("Name: A–Z", "الاسم: أ–ي")}</option><option value="name_desc">{t("Name: Z–A", "الاسم: ي–أ")}</option></select></label>{(query || categoryId || brandId) && <button type="button" onClick={() => { setQuery(""); setDraftQuery(""); setCategoryId(""); setBrandId(""); setPage(1); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">{t("Clear filters", "مسح عوامل التصفية")}</button>}</div>
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {loadingProducts ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" />)}</div> : products.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const price = product.variants.flatMap((variant) => variant.prices).find((item) => !marketId || item.marketId === marketId);
              const image = product.media[0];
              return <Link key={product.id} href={`/products/${encodeURIComponent(product.slug)}`} className="clay-surface clay-interactive group overflow-hidden rounded-[var(--radius-card)] border-white/80 bg-[var(--surface)] transition duration-200">
                <div className="relative aspect-[4/4.6] overflow-hidden bg-[var(--color-ivory-100)]">
                  {image ? <img src={image.url} alt={image.altText ?? product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-xs uppercase tracking-[.2em] text-[var(--color-sage-600)]">{t("Mtjr collection", "مجموعة متجري")}</div>}
                </div>
                <div className="p-4">
                  <p className="truncate text-[11px] uppercase tracking-wider text-[var(--muted)]">{product.brand?.name ?? product.store.name}</p>
                  <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5">{product.name}</h3>
                  <p className="mt-4 text-lg font-semibold text-[var(--color-forest-950)]">{formatPrice(price, markets, locale)}</p>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{t("Sold by", "يُباع بواسطة")} {product.store.name}</p>
                </div>
              </Link>;
            })}
          </div>
        ) : <div className="rounded-2xl border border-dashed border-[var(--color-sage-500)] bg-[var(--color-sage-100)]/50 px-6 py-14 text-center"><h3 className="text-lg font-semibold">{t("The collection is taking shape", "المجموعة قيد التشكّل")}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{query || categoryId ? t("No active products match these filters. Try another search or clear the filters.", "لا توجد منتجات نشطة تطابق عوامل التصفية هذه. جرّب بحثًا آخر أو امسح عوامل التصفية.") : t("Products from approved and active stores will appear here once the catalog is published.", "ستظهر منتجات المتاجر النشطة والمعتمدة هنا عند نشر الكتالوج.")}</p></div>}
      </section>

      {!loadingProducts && pagination.totalPages > 1 && <nav aria-label={t("Product pages", "صفحات المنتجات")} className="mt-8 flex items-center justify-center gap-4"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">{t("Previous", "السابق")}</button><span className="text-sm text-[var(--muted)]">{t("Page", "الصفحة")} {page} {t("of", "من")} {pagination.totalPages} · {pagination.total} {t("products", "منتج")}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">{t("Next", "التالي")}</button></nav>}
      <footer id="about" className="mt-10 bg-[var(--color-forest-950)] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-3 py-6 sm:px-5 sm:py-10 text-sm text-white/70 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <span className="text-xl font-semibold tracking-tight text-white">mtjr<span className="text-[var(--color-copper-500)]">.</span></span>
          <p>{t("A global marketplace built around discovery, trust and independent stores.", "سوق عالمي يقوم على الاكتشاف والثقة والمتاجر المستقلة.")}</p>
          <nav aria-label={t("Legal and account links", "روابط قانونية وروابط الحساب")} className="flex flex-wrap gap-4 text-xs text-white/80"><Link href="/terms" className="hover:text-white">{t("Terms of Use", "شروط الاستخدام")}</Link><Link href="/privacy" className="hover:text-white">{t("Privacy Notice", "إشعار الخصوصية")}</Link><Link href="/account" className="hover:text-white">{t("My account", "حسابي")}</Link><Link href="/seller" className="hover:text-white">{t("Sell on Mtjr", "بِع على متجري")}</Link></nav>
          <span>© {new Date().getFullYear()} Mtjr</span>
        </div>
      </footer>
    </main>
  );
}
