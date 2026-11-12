import { listDiscoverableProducts } from "@/server/catalog/discovery";
import { listActiveBrands, listActiveCategoryTree } from "@/server/catalog/taxonomy";
import { listDiscoverableStores } from "@/server/marketplace/public-stores";
import { getActiveMarketByCode } from "@/server/marketplace/market-query";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";
import { listSponsoredCampaigns } from "@/server/advertising/delivery";

type SearchParams = {
  q?: string;
  page?: string;
  categoryId?: string;
  brandId?: string;
  storeId?: string;
  marketId?: string;
  currencyCode?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
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
  const locale = await getPreferredLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const categoryId = params.categoryId?.trim() || undefined;
  const brandId = params.brandId?.trim() || undefined;
  const storeId = params.storeId?.trim() || undefined;

  const minPrice = params.minPrice?.trim() || undefined;
  const maxPrice = params.maxPrice?.trim() || undefined;
  const inStock = params.inStock === "true";
  const sort = params.sort === "newest" || params.sort === "name_asc" || params.sort === "name_desc"
    ? params.sort
    : q ? "relevance" : "newest";
  // Matjar currently serves Syria only. Resolve the Syrian market centrally;
  // customers no longer need to choose a market before filtering prices.
  const selectedMarket = await getActiveMarketByCode("SY-SYR");
  const marketId = selectedMarket?.id;
  const requestedCurrencyCode = params.currencyCode?.trim().toUpperCase();
  const currencyCode = selectedMarket
    ? (selectedMarket.currencies.some(({ currency }) => currency.code === requestedCurrencyCode)
        ? requestedCurrencyCode
        : selectedMarket.defaultCurrency.code)
    : undefined;
  const selectedCurrency = selectedMarket?.currencies.find(({ currency }) => currency.code === currencyCode)?.currency;
  const [result, categories, brands, stores] = await Promise.all([
    listDiscoverableProducts({ q: q || undefined, page, limit: 24, categoryId, brandId, storeId, marketId, currencyCode, minPrice, maxPrice, inStock: String(inStock), sort, locale }),
    listActiveCategoryTree({ page: 1, limit: 100, locale }),
    listActiveBrands({ page: 1, limit: 100, locale }),
    listDiscoverableStores({ page: 1, limit: 100 })
  ]);
  const sponsored = await listSponsoredCampaigns({ marketId, categoryId, brandId, query: q, limit: 4 });
  const filters = {
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(marketId ? { marketId } : {}),
    ...(currencyCode ? { currencyCode } : {}),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(inStock ? { inStock: "true" } : {}),
    ...(sort !== "newest" ? { sort } : {})
  };
  const categoryCounts = new Map(result.facets.categories.map((facet) => [facet.id, facet.count]));
  const brandCounts = new Map(result.facets.brands.map((facet) => [facet.id, facet.count]));

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1440px] px-3 py-6 sm:px-5 sm:py-10 lg:px-10 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{t("Marketplace discovery", "استكشاف السوق")}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl text-[var(--color-lavender-950)]">{heading}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{description}</p>
      <form action={action} method="get" className="mt-7 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white shadow-[0_12px_36px_rgba(62,47,92,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--color-lavender-50)]/70 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-lavender-950)]">{t("Refine your search", "تصفية نتائج البحث")}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{t("Combine filters to find exactly what you need.", "اجمع عوامل التصفية للوصول إلى ما تبحث عنه.")}</p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[11px] font-semibold text-[var(--color-lavender-700)]">{t("Filters", "الفلاتر")}</span>
        </div>

        <div className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-ink-800)] sm:col-span-2">
            {t("Keywords", "كلمات البحث")}
            <input name="q" maxLength={120} defaultValue={q} placeholder={t("Name, SKU, barcode, brand or store", "الاسم أو SKU أو الرمز الشريطي أو العلامة التجارية أو المتجر")} className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100" />
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-ink-800)]">
            {t("Category", "الفئة")}
            <select name="categoryId" defaultValue={categoryId ?? ""} className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100"><option value="">{t("All categories", "كل الفئات")}</option>{categoryOptions(categories.items).map((item) => <option key={item.id} value={item.id}>{item.name} ({categoryCounts.get(item.id) ?? 0})</option>)}</select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-ink-800)]">
            {t("Brand", "العلامة التجارية")}
            <select name="brandId" defaultValue={brandId ?? ""} className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100"><option value="">{t("All brands", "كل العلامات التجارية")}</option>{brands.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({brandCounts.get(item.id) ?? 0})</option>)}</select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-ink-800)]">
            {t("Store / vendor", "المتجر / البائع")}
            <select name="storeId" defaultValue={storeId ?? ""} className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100"><option value="">{t("All stores", "كل المتاجر")}</option>{stores.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sellerDisplayName ? ` — ${item.sellerDisplayName}` : ""}</option>)}</select>
          </label>
          {marketId ? <input type="hidden" name="marketId" value={marketId} /> : null}
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-ink-800)]">
            {t("Currency", "العملة")}
            <select name="currencyCode" defaultValue={currencyCode ?? ""} disabled={!selectedCurrency} className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"><option value="">{t("Default currency", "العملة الافتراضية")}</option>{selectedMarket?.currencies.map(({ currency }) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select>
          </label>

          <div className="grid min-w-0 gap-1.5 sm:col-span-2">
            <p className="text-xs font-semibold text-[var(--color-ink-800)]">{t("Price range", "نطاق السعر")}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid min-w-0 gap-1 text-[11px] font-medium text-[var(--muted)]">
                {t("Minimum", "أقل سعر")}
                <input name="minPrice" type="number" min="0" step={selectedCurrency ? 1 / (10 ** selectedCurrency.minorUnit) : "any"} defaultValue={minPrice} placeholder="0" className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500" />
              </label>
              <label className="grid min-w-0 gap-1 text-[11px] font-medium text-[var(--muted)]">
                {t("Maximum", "أعلى سعر")}
                <input name="maxPrice" type="number" min="0" step={selectedCurrency ? 1 / (10 ** selectedCurrency.minorUnit) : "any"} defaultValue={maxPrice} placeholder="—" className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition placeholder:text-[var(--muted)] hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500" />
              </label>
            </div>
            {!selectedCurrency ? <p className="text-[11px] leading-5 text-[var(--muted)]">{t("Price filtering is available in the Syrian market currency.", "تصفية الأسعار متاحة بعملة السوق السورية.")}</p> : <p className="text-[11px] text-[var(--muted)]">{t("Prices in", "الأسعار بعملة")} {selectedCurrency.code}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1">
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--color-lavender-50)]/60 px-3 text-xs font-semibold text-[var(--color-ink-800)]">
              <input type="checkbox" name="inStock" value="true" defaultChecked={inStock} className="size-4 accent-[var(--action)]" />
              {t("In stock only", "المتوفر في المخزون فقط")} ({result.facets.inStockCount})
            </label>
          </div>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-ink-800)]">
            {t("Sort by", "ترتيب حسب")}
            <select name="sort" defaultValue={sort} className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-normal text-[var(--color-ink-950)] shadow-sm outline-none transition hover:border-[var(--color-lavender-300)] focus:border-[var(--action)] focus:ring-2 focus:ring-orange-100"><option value="relevance" disabled={!q}>{t("Relevance", "الصلة")}</option><option value="newest">{t("Newest", "الأحدث")}</option><option value="name_asc">{t("Name: A to Z", "الاسم: أ إلى ي")}</option><option value="name_desc">{t("Name: Z to A", "الاسم: ي إلى أ")}</option></select>
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button type="submit" className="h-11 rounded-xl bg-[var(--action)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--action-hover)] focus:outline-none focus:ring-2 focus:ring-orange-200">{t("Apply filters", "تطبيق الفلاتر")}</button>
            <a href={action} className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--color-ink-800)] transition hover:border-[var(--action)] hover:text-[var(--action)]">{t("Clear all", "مسح الكل")}</a>
          </div>
        </div>
      </form>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]"><span>{result.pagination.total} {t("matching products", "منتج مطابق")}</span>{q && <span>{t("Query:", "البحث:")} “{q}” · {t("Sorted by", "مرتبة حسب")} {sort === "relevance" ? t("relevance", "الصلة") : sort.replace("_", " ")}</span>}</div>
      <CatalogListControls action={action} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} params={filters} sort={sort} locale={locale} />
      <CatalogProductGrid products={result.items} locale={locale} sponsored={sponsored} />
      <CatalogListControls action={action} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} params={filters} sort={sort} locale={locale} />
    </main>
  );
}
