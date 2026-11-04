"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Brand = { id: string; slug: string; name: string };
type BrandResponse = { items: Brand[] };

export default function BrandDirectoryPage() {
  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/brands?locale=en&limit=100", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Brands could not be loaded.");
        return response.json() as Promise<BrandResponse>;
      })
      .then((result) => setItems(Array.isArray(result.items) ? result.items : []))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Brands are unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Independent labels</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Discover brands</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Explore active brands and browse their products across the marketplace.</p>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--muted)]" role="status">Loading brands…</p>
      ) : error ? (
        <p className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
      ) : items.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${encodeURIComponent(brand.slug)}`}
              className="flex min-h-28 items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-5 py-4 text-sm font-semibold text-[var(--color-forest-950)] transition hover:-translate-y-0.5 hover:border-[var(--color-sage-500)] hover:shadow-[var(--shadow-card)]"
            >
              <span>{brand.name}</span><span aria-hidden="true" className="text-[var(--color-copper-600)]">↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-sage-500)] bg-[var(--color-sage-100)]/50 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">No active brands yet</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Brands will appear here when they are activated in the marketplace catalog.</p>
        </div>
      )}
    </main>
  );
}
