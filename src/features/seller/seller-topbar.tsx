"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function SellerTopbar() {
  const { locale } = useLocale();
  return (
    <header className="sticky top-0 z-20 hidden h-[var(--dashboard-topbar-height)] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-8 shadow-[var(--shadow-clay)] backdrop-blur-xl lg:flex">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--color-lavender-800)]">MATJAR / SELLER STUDIO</p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-ink-950)]">{translate(locale, "Your business, beautifully organized.", "أعمالك التجارية، منظمة بوضوح وأناقة.")}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-[var(--color-mint-300)] bg-[var(--color-mint-50)] px-3 py-2 text-[11px] font-semibold text-[var(--color-mint-800)]">● {translate(locale, "Seller workspace", "مساحة عمل البائع")}</span>
        <Link href="/" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-ink-800)] shadow-[var(--shadow-clay)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-clay-hover)]">{translate(locale, "View marketplace", "عرض واجهة المتجر")} ↗</Link>
      </div>
    </header>
  );
}
