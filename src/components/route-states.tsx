"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export function RouteLoadingState({ label = "Loading page" }: { label?: string }) {
  const { locale } = useLocale();
  const localizedLabel = label === "Loading your account"
    ? translate(locale, "Loading your account", "جارٍ تحميل حسابك")
    : translate(locale, label, label === "Loading page" ? "جارٍ تحميل الصفحة" : label);
  return (
    <main
      aria-busy="true"
      aria-label={localizedLabel}
      className="mx-auto min-h-[50vh] w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <div role="status" className="animate-pulse space-y-5">
        <span className="sr-only">{localizedLabel}</span>
        <div className="h-8 w-2/5 rounded-xl bg-[var(--color-lavender-100)]" />
        <div className="h-4 w-3/5 rounded-lg bg-[var(--surface-soft)]" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-40 rounded-[var(--radius-card)] bg-[var(--surface)] shadow-[var(--shadow-clay)]" />
          <div className="h-40 rounded-[var(--radius-card)] bg-[var(--surface)] shadow-[var(--shadow-clay)]" />
          <div className="h-40 rounded-[var(--radius-card)] bg-[var(--surface)] shadow-[var(--shadow-clay)]" />
        </div>
      </div>
    </main>
  );
}

export function RouteErrorState({
  error,
  retry
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { locale } = useLocale();
  useEffect(() => {
    if (error.digest) console.error("Route error boundary:", error.digest);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
      <section
        aria-labelledby="route-error-title"
        className="clay-surface w-full rounded-[var(--radius-card)] p-6 sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-danger)]">
          {translate(locale, "Page unavailable", "الصفحة غير متاحة")}
        </p>
        <h1 id="route-error-title" className="mt-2 text-2xl font-bold text-[var(--foreground)]">
          {translate(locale, "We couldn’t load this page", "تعذر تحميل هذه الصفحة")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {translate(locale, "Your data has not been changed by this error. Try loading the page again, or return to the marketplace.", "لم يؤثر هذا الخطأ في بياناتك. حاول تحميل الصفحة مجددًا أو عُد إلى السوق.")}
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-[var(--muted)]">{translate(locale, "Reference:", "المرجع:")} {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={retry}
            className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-clay)] transition hover:opacity-90"
          >
            {translate(locale, "Try again", "حاول مجددًا")}
          </button>
          <Link
            href="/"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            {translate(locale, "Go to home", "العودة إلى الرئيسية")}
          </Link>
        </div>
      </section>
    </main>
  );
}
