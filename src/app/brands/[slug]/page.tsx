import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveBrandBySlug } from "@/server/catalog/taxonomy";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; page?: string; sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getPreferredLocale();
  const item = await getActiveBrandBySlug(slug, locale);
  return item ? {
    title: item.seoTitle,
    description: item.seoDescription ?? `Discover published products by ${item.name} on Mtjr.`,
    alternates: { canonical: `/brands/${encodeURIComponent(item.slug)}` }
  } : { title: translate(locale, "Brand not found", "العلامة التجارية غير موجودة"), robots: { index: false, follow: false } };
}
export default async function BrandDetailPage({ params, searchParams }: Props) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const locale = await getPreferredLocale();
  const brand = await getActiveBrandBySlug(slug, locale);
  if (!brand) notFound();
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  const q = (search.q ?? "").trim().slice(0, 120);
  const sort = search.sort === "name_asc" || search.sort === "name_desc" || (q && search.sort === "relevance")
    ? search.sort
    : q ? "relevance" : "newest";
  const result = await listDiscoverableProducts({ brandId: brand.id, q: q || undefined, page, limit: 24, sort, locale });

  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{translate(locale, "Marketplace brand", "علامة السوق التجارية")}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink-950)]">{brand.name}</h1>
    {brand.description && <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{brand.description}</p>}
    {brand.websiteUrl && <a href={brand.websiteUrl} rel="nofollow noopener noreferrer" target="_blank" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-ink-600)] underline">{translate(locale, "Brand website", "موقع العلامة التجارية")}</a>}
    <p className="mt-5 text-xs text-[var(--muted)]">{result.pagination.total} {translate(locale, "published products", "منتج منشور")}</p>
    <CatalogListControls action={`/brands/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} locale={locale} />
    <CatalogProductGrid products={result.items} locale={locale} />
    <CatalogListControls action={`/brands/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} locale={locale} />

  </main>;
}
