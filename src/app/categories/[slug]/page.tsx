import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveCategoryBySlug } from "@/server/catalog/taxonomy";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";
import CatalogListControls from "@/features/storefront/catalog-list-controls";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";
import { listSponsoredCampaigns } from "@/server/advertising/delivery";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; page?: string; sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getPreferredLocale();
  const item = await getActiveCategoryBySlug(slug, locale);
  return item ? {
    title: item.seoTitle,
    description: item.seoDescription ?? `Browse published ${item.name} products on Mtjr.`,
    alternates: { canonical: `/categories/${encodeURIComponent(item.slug)}` }
  } : { title: translate(locale, "Category not found", "الفئة غير موجودة"), robots: { index: false, follow: false } };
}
export default async function CategoryDetailPage({ params, searchParams }: Props) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const locale = await getPreferredLocale();
  const category = await getActiveCategoryBySlug(slug, locale);
  if (!category) notFound();
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  const q = (search.q ?? "").trim().slice(0, 120);
  const sort = search.sort === "name_asc" || search.sort === "name_desc" || (q && search.sort === "relevance")
    ? search.sort
    : q ? "relevance" : "newest";
  const [result, markets] = await Promise.all([
    listDiscoverableProducts({ categoryId: category.id, q: q || undefined, page, limit: 24, sort, locale }),
    import("@/server/marketplace/market-query").then((module) => module.listActiveMarkets())
  ]);
  const sponsored = await listSponsoredCampaigns({ marketId: markets[0]?.id, categoryId: category.id, query: q, limit: 4 });

  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{translate(locale, "Marketplace category", "فئة السوق")}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink-950)]">{category.name}</h1>
    {category.description && <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{category.description}</p>}
    <p className="mt-5 text-xs text-[var(--muted)]">{result.pagination.total} {translate(locale, "published products", "منتج منشور")}</p>
    <CatalogListControls action={`/categories/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} locale={locale} />
    <CatalogProductGrid products={result.items} locale={locale} sponsored={sponsored} />
    <CatalogListControls action={`/categories/${encodeURIComponent(slug)}`} query={q} page={result.pagination.page} totalPages={result.pagination.totalPages} sort={sort} params={{ sort }} locale={locale} />

  </main>;
}
