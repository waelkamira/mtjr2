import type { ReactNode } from "react";
import Link from "next/link";
import SellerNavigation from "@/features/seller/seller-navigation";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <SellerNavigation />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-[var(--border)] bg-white/90 px-8 backdrop-blur lg:flex">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--color-copper-600)]">MATJAR / SELLER CENTER</p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--color-onyx)]">Seller operations</p>
          </div>
          <Link href="/" className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--background)]">View marketplace ↗</Link>
        </header>
        {children}
      </div>
    </div>
  );
}
