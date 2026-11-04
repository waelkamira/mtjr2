import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveBrandBySlug } from "@/server/catalog/taxonomy";
import { listDiscoverableProducts } from "@/server/catalog/discovery";
import CatalogProductGrid from "@/features/storefront/catalog-product-grid";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getActiveBrandBySlug(slug);
  return item ? { title: item.name, description: item.description ?? `Discover published products by ${item.name} on Mtjr.`, alternates: { canonical: `/brands/${encodeURIComponent(item.slug)}` } } : { title: "Brand not found", robots: { index: false, follow: false } };
}
export default async function BrandDetailPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getActiveBrandBySlug(slug);
  if (!brand) notFound();
  const result = await listDiscoverableProducts({ brandId: brand.id, page: 1, limit: 48 });
  return <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Marketplace brand</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{brand.name}</h1>
    {brand.description && <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{brand.description}</p>}
    {brand.websiteUrl && <a href={brand.websiteUrl} rel="nofollow noopener noreferrer" target="_blank" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-forest-800)] underline">Brand website</a>}
    <p className="mt-5 text-xs text-[var(--muted)]">{result.pagination.total} published products</p>
    <CatalogProductGrid products={result.items} />
  </main>;
}
