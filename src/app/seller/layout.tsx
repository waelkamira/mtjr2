import type { ReactNode } from "react";
import Link from "next/link";
import SellerNavigation from "@/features/seller/seller-navigation";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,var(--color-lavender-50),transparent_42%),radial-gradient(ellipse_at_top_right,var(--color-mint-50),transparent_38%),var(--background)] lg:flex">
      <SellerNavigation />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 hidden h-[var(--dashboard-topbar-height)] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-8 shadow-[var(--shadow-clay)] backdrop-blur-xl lg:flex">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--color-lavender-800)]">MATJAR / SELLER STUDIO</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-ink-950)]">Your business, beautifully organized.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--color-mint-300)] bg-[var(--color-mint-50)] px-3 py-2 text-[11px] font-semibold text-[var(--color-mint-800)]">● Seller workspace</span>
            <Link href="/" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-ink-700)] shadow-[var(--shadow-clay)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-clay-hover)]">View marketplace ↗</Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
