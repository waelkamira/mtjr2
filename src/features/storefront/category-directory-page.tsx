"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Category = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  children: Category[];
};

type CategoryResponse = { items: Category[] };

function flatten(items: Category[]): Category[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

export default function CategoryDirectoryPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/categories?locale=en&limit=100")
      .then(async (response) => {
        if (!response.ok) throw new Error("Categories could not be loaded.");
        return response.json() as Promise<CategoryResponse>;
      })
      .then((result) => {
        if (active) setItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Categories are unavailable.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => flatten(items), [items]);

  return (
    <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Explore the marketplace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Shop by category</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Browse the active catalog categories and discover products from independent stores.</p>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--muted)]" role="status">Loading categories…</p>
      ) : error ? (
        <p className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
      ) : categories.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${encodeURIComponent(category.slug)}`}
              className="group relative flex min-h-44 items-end overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--color-sage-100)] p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
            >
              {category.imageUrl && <img src={category.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              <span className="absolute inset-0 bg-gradient-to-t from-[var(--color-forest-950)]/90 via-[var(--color-forest-950)]/15 to-transparent" />
              <span className="relative text-base font-semibold text-white">{category.name}<span aria-hidden="true" className="ml-2 text-[var(--color-sage-200)]">↗</span></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-sage-500)] bg-[var(--color-sage-100)]/50 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">No active categories yet</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Categories will appear here when they are activated in the marketplace catalog.</p>
        </div>
      )}
    </main>
  );
}
