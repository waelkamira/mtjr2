import Link from "next/link";
import type { Metadata } from "next";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPreferredLocale();
  return {
    title: translate(locale, "Page not found", "الصفحة غير موجودة"),
    description: translate(locale, "The page or item you requested could not be found.", "تعذر العثور على الصفحة أو العنصر المطلوب.")
  };
}

export default async function NotFound() {
  const locale = await getPreferredLocale();
  return (
    <main className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
      <section
        aria-labelledby="not-found-title"
        className="clay-surface w-full rounded-[var(--radius-card)] p-6 sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-lavender-600)]">
          Error 404
        </p>
        <h1 id="not-found-title" className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          {translate(locale, "We couldn’t find that page", "لم نتمكن من العثور على هذه الصفحة")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {translate(locale, "The link may be outdated, or the item may no longer be available.", "قد يكون الرابط قديمًا أو لم يعد العنصر متاحًا.")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-clay)]"
          >
            {translate(locale, "Go to home", "العودة إلى الرئيسية")}
          </Link>
          <Link
            href="/products"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            {translate(locale, "Browse products", "تصفح المنتجات")}
          </Link>
        </div>
      </section>
    </main>
  );
}
