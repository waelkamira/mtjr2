"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Brand = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
};
type BrandResponse = { items: Brand[]; pagination?: { total?: number } };

const brandPalettes = [
  "from-orange-100 via-amber-50 to-white text-orange-700",
  "from-violet-100 via-fuchsia-50 to-white text-violet-700",
  "from-emerald-100 via-teal-50 to-white text-emerald-700",
  "from-sky-100 via-cyan-50 to-white text-sky-700",
  "from-rose-100 via-pink-50 to-white text-rose-700",
  "from-indigo-100 via-blue-50 to-white text-indigo-700"
];

function BrandEmblem({ name, logoUrl, palette }: { name: string; logoUrl: string | null; palette: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = name.trim().split(/\\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toLocaleUpperCase();
  const hasLogo = Boolean(logoUrl?.trim()) && !logoFailed;

  return (
    <span className={"relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br " + palette + " shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]"}>
      {hasLogo ? (
        <img
          src={logoUrl!}
          alt={name + " logo"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
          className="h-full w-full bg-white/90 object-contain p-2.5"
        />
      ) : (
        <>
          <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute inset-0 h-full w-full opacity-20" fill="none">
            <path d="M24 5 29.5 18.5 43 24 29.5 29.5 24 43 18.5 29.5 5 24 18.5 18.5 24 5Z" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span className="relative text-xl font-black tracking-tight">{initials || "B"}</span>
        </>
      )}
    </span>
  );
}

function BrandCard({ brand, index, locale }: { brand: Brand; index: number; locale: "ar" | "en" }) {
  const palette = brandPalettes[index % brandPalettes.length];
  const description = brand.description?.trim();

  return (
    <Link
      href={"/brands/" + encodeURIComponent(brand.slug)}
      className="group relative flex min-h-[13.5rem] flex-col overflow-hidden rounded-[1.4rem] border border-stone-200/80 bg-white p-5 shadow-[0_5px_18px_rgba(15,23,42,0.045)] transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_18px_38px_rgba(249,115,22,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-300 via-amber-300 to-orange-100 opacity-70 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <BrandEmblem name={brand.name} logoUrl={brand.logoUrl} palette={palette} />
        <span className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition group-hover:border-orange-200 group-hover:bg-orange-500 group-hover:text-white">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d={locale === "ar" ? "M16 10H5m5-5-5 5 5 5" : "M5 10h11m-5-5 5 5-5 5"} />
          </svg>
        </span>
      </div>
      <div className="mt-5 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">{translate(locale, "Brand", "علامة تجارية")}</p>
        <h2 className="mt-1 truncate text-base font-extrabold tracking-tight text-stone-900 transition-colors group-hover:text-orange-700">{brand.name}</h2>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-stone-500">
          {description || translate(locale, "Explore products from this brand.", "اكتشف منتجات هذه العلامة التجارية.")}
        </p>
      </div>
    </Link>
  );
}

export default function BrandDirectoryPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalBrands, setTotalBrands] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/brands?locale=" + locale + "&limit=100", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("Brands could not be loaded.", "تعذّر تحميل العلامات التجارية."));
        return response.json() as Promise<BrandResponse>;
      })
      .then((result) => {
        setItems(Array.isArray(result.items) ? result.items : []);
        setTotalBrands(typeof result.pagination?.total === "number" ? result.pagination.total : (Array.isArray(result.items) ? result.items.length : 0));
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : t("Brands are unavailable.", "العلامات التجارية غير متاحة."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locale, t]);

  return (
    <main className="mx-auto min-h-[65vh] max-w-[1440px] px-4 py-7 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 px-6 py-8 shadow-[0_14px_38px_rgba(249,115,22,0.08)] sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-orange-200 bg-white text-orange-600 shadow-[0_6px_18px_rgba(249,115,22,0.12)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13 13 20 3 10V3h7l10 10Z" />
              <circle cx="7.5" cy="7.5" r="1.2" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">{t("The world of brands", "عالم العلامات التجارية")}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">{t("Discover brands", "اكتشف العلامات التجارية")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">{t("Explore distinctive brands and find products selected from across the marketplace.", "اكتشف علامات تجارية مميزة واعثر على منتجات مختارة من مختلف أنحاء السوق.")}</p>
          </div>
        </div>
        {!loading && !error && items.length > 0 && (
          <div className="relative mt-6 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/85 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-lime-500 shadow-[0_0_0_3px_rgba(132,204,22,0.14)]" />
            {totalBrands} {t("active brands", "علامة تجارية متاحة")}
          </div>
        )}
      </section>

      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label={t("Loading brands", "جارٍ تحميل العلامات التجارية")}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="min-h-[13.5rem] animate-pulse rounded-[1.4rem] border border-stone-100 bg-white p-5 shadow-sm">
              <div className="h-[4.5rem] w-[4.5rem] rounded-2xl bg-stone-100" />
              <div className="mt-6 h-3 w-20 rounded bg-stone-100" />
              <div className="mt-3 h-4 w-2/3 rounded bg-stone-100" />
              <div className="mt-3 h-3 w-full rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-sm" role="alert">{error}</div>
      ) : items.length ? (
        <section aria-label={t("Brand directory", "دليل العلامات التجارية")} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((brand, index) => <BrandCard key={brand.id} brand={brand} index={index} locale={locale} />)}
        </section>
      ) : (
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-orange-200 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/70 px-6 py-14 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-orange-100 bg-white text-orange-500 shadow-md">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13 13 20 3 10V3h7l10 10Z" />
              <circle cx="7.5" cy="7.5" r="1.2" />
            </svg>
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-stone-900">{t("No active brands yet", "لا توجد علامات تجارية نشطة بعد")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{t("Brands will appear here when they are activated in the marketplace catalog.", "ستظهر العلامات التجارية هنا عند تفعيلها في كتالوج السوق.")}</p>
        </div>
      )}
    </main>
  );
}
