import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoverableStores } from "@/server/marketplace/public-stores";
import CatalogListControls from "@/features/storefront/catalog-list-controls";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Stores", "المتاجر"),
    description: translate(locale, "Discover active stores from approved marketplace sellers.", "اكتشف المتاجر النشطة التي يديرها بائعون معتمدون.")
  };
}

type Props = { searchParams: Promise<{ q?: string; page?: string }> };
export default async function StoresPage({ searchParams }: Props) {
  const locale = await getPreferredLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const search = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(search.page) || 1));
  const q = (search.q ?? "").trim().slice(0, 120);
  const result = await listDiscoverableStores({ page, limit: 24, q: q || undefined });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{t("Independent commerce", "تجارة مستقلة")}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink-950)]">{t("Discover stores", "اكتشف المتاجر")}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t("Explore active stores operated by approved sellers across the marketplace.", "استكشف المتاجر النشطة التي يديرها بائعون معتمدون في السوق.")}</p>
    <CatalogListControls action="/stores" query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} label="Search stores" locale={locale} />
    {result.items.length ? <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {result.items.map((store) => <Link key={store.id} href={`/stores/${encodeURIComponent(store.slug)}`} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
        <div className="relative h-24 bg-[linear-gradient(115deg,#dcebef_0%,#c5dbe2_48%,#e2e5ef_100%)]">
          {store.bannerUrl && <img src={store.bannerUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
        </div>
        <div className="p-5">
          <div className="-mt-11 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-[var(--surface)] bg-[linear-gradient(145deg,#e9edf2,#c9d9e2)] text-xl font-black text-[#35566b] shadow-sm">
            {store.logoUrl ? <img src={store.logoUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : store.name.slice(0, 1).toUpperCase()}
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-ink-950)]">{store.name}</h2>
          {store.sellerDisplayName && <p className="mt-1 text-sm text-[var(--muted)]">{t("Seller:", "البائع:")} {store.sellerDisplayName}</p>}
          {store.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{store.description}</p>}
          <p className="mt-2 text-sm text-[var(--muted)]">{store.productCount} {t("published products", "منتج منشور")}</p>
          <span className="mt-4 inline-flex text-sm font-semibold text-[var(--color-ink-600)]">{t("Visit store", "زيارة المتجر")} ↗</span>
        </div>
      </Link>)}
    </div> : <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-sage-500)] bg-[var(--color-sage-100)]/50 px-6 py-14 text-center"><h2 className="text-lg font-semibold text-[var(--color-ink-950)]">{t("No active stores found", "لم يتم العثور على متاجر نشطة")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{t("Try a different store name or clear the search.", "جرّب اسم متجر آخر أو امسح البحث.")}</p></div>}
    <CatalogListControls action="/stores" query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} label="Search stores" locale={locale} />
  </main>;
}
