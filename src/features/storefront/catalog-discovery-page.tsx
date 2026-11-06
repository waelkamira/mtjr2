import { listDiscoverableProducts } from "@/server/catalog/discovery";
import { listActiveBrands, listActiveCategoryTree } from "@/server/catalog/taxonomy";
import { listDiscoverableStores } from "@/server/marketplace/public-stores";
import { listActiveMarkets } from "@/server/marketplace/market-query";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

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
  const marketId = params.marketId?.trim() || undefined;
  const currencyCode = marketId ? params.currencyCode?.trim().toUpperCase() || undefined : undefined;
  const minPrice = params.minPrice?.trim() || undefined;
  const maxPrice = params.maxPrice?.trim() || undefined;
  const inStock = params.inStock === "true";
  const sort = params.sort === "newest" || params.sort === "name_asc" || params.sort === "name_desc"
    ? params.sort
    : q ? "relevance" : "newest";
  const [result, categories, brands, stores, markets] = await Promise.all([
    listDiscoverableProducts({ q: q || undefined, page, limit: 24, categoryId, brandId, storeId, marketId, currencyCode, minPrice, maxPrice, inStock: String(inStock), sort, locale }),
    listActiveCategoryTree({ page: 1, limit: 100, locale }),
    listActiveBrands({ page: 1, limit: 100, locale }),
    listDiscoverableStores({ page: 1, limit: 100 }),
    listActiveMarkets()
  ]);
  const selectedMarket = markets.find((market) => market.id === marketId);
  const selectedCurrency = selectedMarket?.currencies.find(({ currency }) => currency.code === currencyCode)?.currency;
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
    <main className="mx-auto min-h-[70vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{t("Marketplace discovery", "استكشاف السوق")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-lavender-950)]">{heading}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{description}</p>
      <form action={action} method="get" className="mt-7 grid gap-3 clay-surface rounded-[1.5rem] border-white/80 bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-medium sm:col-span-2">{t("Keywords", "كلمات البحث")}<input name="q" maxLength={120} defaultValue={q} placeholder={t("Name, SKU, barcode, brand or store", "الاسم أو SKU أو الرمز الشريطي أو العلامة التجارية أو المتجر")} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm" /></label>
        <label className="grid gap-1 text-xs font-medium">{t("Category", "الفئة")}<select name="categoryId" defaultValue={categoryId ?? ""} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm"><option value="">{t("All categories", "كل الفئات")}</option>{categoryOptions(categories.items).map((item) => <option key={item.id} value={item.id}>{item.name} ({categoryCounts.get(item.id) ?? 0})</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">{t("Brand", "العلامة التجارية")}<select name="brandId" defaultValue={brandId ?? ""} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm"><option value="">{t("All brands", "كل العلامات التجارية")}</option>{brands.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({brandCounts.get(item.id) ?? 0})</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">{t("Store / vendor", "المتجر / البائع")}<select name="storeId" defaultValue={storeId ?? ""} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm"><option value="">{t("All stores", "كل المتاجر")}</option>{stores.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sellerDisplayName ? ` — ${item.sellerDisplayName}` : ""}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">{t("Market", "السوق")}<select name="marketId" defaultValue={marketId ?? ""} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm"><option value="">{t("All active markets", "كل الأسواق النشطة")}</option>{markets.map((market) => <option key={market.id} value={market.id}>{market.name} · {market.country.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">{t("Currency", "العملة")}<select name="currencyCode" defaultValue={currencyCode ?? ""} disabled={!selectedMarket} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm disabled:bg-gray-100"><option value="">{t("All enabled currencies", "كل العملات المفعّلة")}</option>{selectedMarket?.currencies.map(({ currency }) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium">{t("Minimum price", "أقل سعر")}<input name="minPrice" type="number" min="0" step={selectedCurrency ? 1 / (10 ** selectedCurrency.minorUnit) : "any"} defaultValue={minPrice} disabled={!selectedCurrency} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm disabled:bg-gray-100" /></label>
        <label className="grid gap-1 text-xs font-medium">{t("Maximum price", "أعلى سعر")}<input name="maxPrice" type="number" min="0" step={selectedCurrency ? 1 / (10 ** selectedCurrency.minorUnit) : "any"} defaultValue={maxPrice} disabled={!selectedCurrency} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm disabled:bg-gray-100" /></label>
        <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" name="inStock" value="true" defaultChecked={inStock} /> {t("In stock only", "المتوفر في المخزون فقط")} ({result.facets.inStockCount})</label>
        <label className="grid gap-1 text-xs font-medium">{t("Sort by", "ترتيب حسب")}<select name="sort" defaultValue={sort} className="clay-surface-inset rounded-xl border-white/70 bg-[var(--color-lavender-50)] px-3 py-2.5 text-sm"><option value="relevance" disabled={!q}>{t("Relevance", "الصلة")}</option><option value="newest">{t("Newest", "الأحدث")}</option><option value="name_asc">{t("Name: A to Z", "الاسم: أ إلى ي")}</option><option value="name_desc">{t("Name: Z to A", "الاسم: ي إلى أ")}</option></select></label>
        <div className="flex items-end gap-2"><button type="submit" className="rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white">{t("Apply filters", "تطبيق عوامل التصفية")}</button><a href={action} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm">{t("Clear", "مسح")}</a></div>
      </form>
      <div className="mt-7 flex items-center justify-between text-sm text-[var(--muted)]"><span>{result.pagination.total} {t("matching products", "منتج مطابق")}</span>{q && <span>{t("Query:", "البحث:")} “{q}” · {t("Sorted by", "مرتبة حسب")} {sort === "relevance" ? t("relevance", "الصلة") : sort.replace("_", " ")}</span>}</div>
      <CatalogListControls action={action} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} params={filters} sort={sort} locale={locale} />
      <CatalogProductGrid products={result.items} locale={locale} />
      <CatalogListControls action={action} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} params={filters} sort={sort} locale={locale} />
    </main>
  );
}
