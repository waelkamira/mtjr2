"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function SellerTopbar() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const section = pathname === "/seller" ? translate(locale, "Dashboard", "لوحة التحكم") : pathname.startsWith("/seller/products") ? translate(locale, "Products", "المنتجات") : pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Seller";
  return (
    <header className="sticky top-0 z-20 hidden h-[var(--dashboard-topbar-height)] items-center justify-between border-b border-[#d6e0e7] bg-[#eaf1f4]/90 px-8 shadow-[0_8px_24px_rgba(42,67,87,.08),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl lg:flex">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#55748b]">MATJAR / SELLER STUDIO</p>
        <p className="mt-1 text-sm font-semibold text-[#24394d]">{translate(locale, "Your business, beautifully organized.", "أعمالك التجارية، منظمة بوضوح وأناقة.")}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/seller/products" className="rounded-full border border-white/80 bg-[#e0edf1] px-4 py-2.5 text-xs font-bold text-[#29475b] shadow-[0_4px_12px_rgba(38,65,84,.12),inset_0_1px_0_white] transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(38,65,84,.16)]">{translate(locale, "Manage catalog", "إدارة المنتجات")}</Link>
        <Link href="/notifications" aria-label={translate(locale, "Notifications", "الإشعارات")} className="grid size-10 place-items-center rounded-full border border-white/80 bg-[#dce9ee] text-[#385a70] shadow-[0_4px_12px_rgba(38,65,84,.12),inset_0_1px_0_white] transition hover:-translate-y-0.5"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></Link>
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-white/80 bg-[#a9d2d1] text-[#23485a] shadow-[0_4px_12px_rgba(38,65,84,.12),inset_0_1px_0_rgba(255,255,255,.8)]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5"/></svg></span>
      </div>
    </header>
  );
}
