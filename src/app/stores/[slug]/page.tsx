import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDiscoverableStoreBySlug } from "@/server/marketplace/public-stores";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";
import StoreReviews from "@/features/storefront/store-reviews";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; page?: string; sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getPreferredLocale();
  const store = await getDiscoverableStoreBySlug(slug);
  return store ? { title: store.name, description: store.description || translate(locale, `Browse published products from ${store.name} on Mtjr.`, `تصفّح المنتجات المنشورة من ${store.name} على متجري.`), alternates: { canonical: `/stores/${encodeURIComponent(store.slug)}` } } : { title: translate(locale, "Store not found", "المتجر غير موجود"), robots: { index: false, follow: false } };
}
export default async function StoreDetailPage({ params, searchParams }: Props) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const locale = await getPreferredLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const store = await getDiscoverableStoreBySlug(slug);
  if (!store) notFound();
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  const q = (search.q ?? "").trim().slice(0, 120);
  const sort = search.sort === "name_asc" || search.sort === "name_desc" || (q && search.sort === "relevance")
    ? search.sort
    : q ? "relevance" : "newest";
  const result = await listDiscoverableProducts({ storeId: store.id, q: q || undefined, page, limit: 24, sort, locale });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_12px_30px_rgba(34,55,72,.09)]">
      <div className="relative h-36 bg-[linear-gradient(115deg,#dcebef_0%,#c5dbe2_48%,#e2e5ef_100%)] sm:h-52">
        {store.bannerUrl && <img src={store.bannerUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#203449]/35 to-transparent" />
      </div>
      <div className="relative flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
        <div className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border-4 border-white bg-[linear-gradient(145deg,#e9edf2,#c9d9e2)] text-3xl font-black text-[#35566b] shadow-lg sm:h-28 sm:w-28">
          {store.logoUrl ? <img src={store.logoUrl} alt={t("Store logo", "شعار المتجر")} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : store.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{t("Verified marketplace seller", "بائع موثّق في السوق")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-ink-950)] sm:text-3xl">{store.name}</h1>
          {store.sellerDisplayName && <p className="mt-1 text-sm text-[var(--muted)]">{t("Operated by", "يديره")} {store.sellerDisplayName}</p>}
        </div>
        <p className="pb-2 text-sm font-semibold text-[var(--muted)]">{result.pagination.total} {t("published products", "منتج منشور")}</p>
      </div>
      {store.description && <p className="max-w-4xl px-5 pb-6 text-sm leading-7 text-[var(--muted)] sm:px-7">{store.description}</p>}
      {(store.shippingPolicy || store.returnsPolicy || store.privacyPolicy || store.termsOfSale) && <div className="grid gap-3 border-t border-[var(--border)] px-5 py-5 sm:grid-cols-2 sm:px-7">
        {store.shippingPolicy && <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><summary className="cursor-pointer text-sm font-bold text-[var(--color-ink-950)]">{t("Shipping & delivery", "الشحن والتوصيل")}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">{store.shippingPolicy}</p></details>}
        {store.returnsPolicy && <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><summary className="cursor-pointer text-sm font-bold text-[var(--color-ink-950)]">{t("Returns & refunds", "الإرجاع والاسترداد")}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">{store.returnsPolicy}</p></details>}
        {store.privacyPolicy && <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><summary className="cursor-pointer text-sm font-bold text-[var(--color-ink-950)]">{t("Privacy notice", "إشعار الخصوصية")}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">{store.privacyPolicy}</p></details>}
        {store.termsOfSale && <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><summary className="cursor-pointer text-sm font-bold text-[var(--color-ink-950)]">{t("Terms of sale", "شروط البيع")}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">{store.termsOfSale}</p></details>}
      </div>}
    </section>
    <CatalogListControls action={`/stores/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} locale={locale} />
    <CatalogProductGrid products={result.items} locale={locale} />
    <CatalogListControls action={`/stores/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} locale={locale} />
    <StoreReviews storeId={store.id} storeName={store.name} />
  </main>;
}
