"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Brand = { id: string; slug: string; name: string };
type BrandResponse = { items: Brand[] };

export default function BrandDirectoryPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/brands?locale=${locale}&limit=100`)
      .then(async (response) => {
        if (!response.ok) throw new Error(t("Brands could not be loaded.", "تعذّر تحميل العلامات التجارية."));
        return response.json() as Promise<BrandResponse>;
      })
      .then((result) => {
        if (active) setItems(Array.isArray(result.items) ? result.items : []);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : t("Brands are unavailable.", "العلامات التجارية غير متاحة."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [locale, t]);

  return (
    <main className="mx-auto min-h-[65vh] max-w-[1440px] px-3 py-6 sm:px-5 sm:py-10 lg:px-10 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">{t("Independent labels", "علامات تجارية مستقلة")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">{t("Discover brands", "اكتشف العلامات التجارية")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("Explore active brands and browse their products across the marketplace.", "استكشف العلامات التجارية النشطة وتصفّح منتجاتها في أنحاء السوق.")}</p>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--muted)]" role="status">{t("Loading brands…", "جارٍ تحميل العلامات التجارية…")}</p>
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
          <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{t("No active brands yet", "لا توجد علامات تجارية نشطة بعد")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("Brands will appear here when they are activated in the marketplace catalog.", "ستظهر العلامات التجارية هنا عند تفعيلها في كتالوج السوق.")}</p>
        </div>
      )}
    </main>
  );
}
