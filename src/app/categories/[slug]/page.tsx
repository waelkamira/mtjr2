import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveCategoryBySlug } from "@/server/catalog/taxonomy";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getActiveCategoryBySlug(slug);
  return item ? { title: item.name, description: item.description ?? `Browse published ${item.name} products on Mtjr.`, alternates: { canonical: `/categories/${encodeURIComponent(item.slug)}` } } : { title: "Category not found", robots: { index: false, follow: false } };
}
export default async function CategoryDetailPage({ params }: Props) {
  const { slug } = await params;
  const category = await getActiveCategoryBySlug(slug);
  if (!category) notFound();
  const result = await listDiscoverableProducts({ categoryId: category.id, page: 1, limit: 48 });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Marketplace category</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{category.name}</h1>
    {category.description && <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{category.description}</p>}
    <p className="mt-5 text-xs text-[var(--muted)]">{result.pagination.total} published products</p>
    <CatalogProductGrid products={result.items} />
  </main>;
}
