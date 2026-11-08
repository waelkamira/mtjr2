"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function SellerTopbar() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const section = pathname === "/seller" ? translate(locale, "Dashboard", "لوحة التحكم")
    : pathname.startsWith("/seller/products") ? translate(locale, "Products", "المنتجات")
    : pathname.startsWith("/seller/orders") ? translate(locale, "Orders", "الطلبات")
    : pathname.startsWith("/seller/inventory") ? translate(locale, "Inventory", "المخزون")
    : pathname.startsWith("/seller/shipping") ? translate(locale, "Shipping", "الشحن")
    : pathname.startsWith("/seller/returns") ? translate(locale, "Returns", "المرتجعات")
    : pathname.startsWith("/seller/messages") ? translate(locale, "Messages", "الرسائل")
    : pathname.startsWith("/seller/questions") ? translate(locale, "Product questions", "أسئلة المنتجات")
    : pathname.startsWith("/seller/reviews") ? translate(locale, "Reviews", "التقييمات")
    : pathname.startsWith("/seller/advertising") ? translate(locale, "Advertising", "الإعلانات")
    : pathname.startsWith("/seller/staff") ? translate(locale, "Team & access", "الفريق والصلاحيات")
    : translate(locale, "Seller studio", "استوديو البائع");

  return (
    <header className="sticky top-0 z-20 flex min-h-[var(--dashboard-topbar-height)] flex-wrap items-center justify-between gap-3 border-b border-[#d6e0e7] bg-[#eaf1f4]/95 px-4 py-3 shadow-[0_8px_24px_rgba(42,67,87,.08),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl sm:px-6 lg:h-[var(--dashboard-topbar-height)] lg:flex-nowrap lg:px-8">
      <div className="min-w-[150px]">
        <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#55748b]">MATJAR / SELLER STUDIO</p>
        <p className="mt-1 text-base font-black text-[#24394d]">{section}</p>
      </div>
      <form action="/seller/products" method="GET" role="search" className="order-3 flex w-full max-w-none flex-1 items-center gap-3 rounded-full border border-white/90 bg-[linear-gradient(145deg,#e5eef2,#d4e2e8)] px-4 py-2.5 text-[#567184] shadow-[inset_0_3px_8px_rgba(43,69,88,.12),0_1px_0_white] lg:order-none lg:mx-6 lg:max-w-[440px]">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5 shrink-0"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
        <input name="search" aria-label={translate(locale, "Search products", "ابحث عن المنتجات")} placeholder={translate(locale, "Search products, SKU…", "ابحث عن المنتجات أو رمز SKU...")} className="min-w-0 flex-1 bg-transparent text-sm text-[#29475b] outline-none placeholder:text-[#8196a2]" />
        <button type="submit" className="rounded-full bg-[#a9d2d1] px-3 py-1.5 text-[11px] font-bold text-[#23485a] shadow-[0_3px_8px_rgba(38,65,84,.12),inset_0_1px_0_white]">{translate(locale, "Search", "بحث")}</button>
      </form>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/seller/products" className="hidden rounded-full border border-white/80 bg-[#e0edf1] px-4 py-2.5 text-xs font-bold text-[#29475b] shadow-[0_4px_12px_rgba(38,65,84,.12),inset_0_1px_0_white] transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(38,65,84,.16)] sm:inline-flex">{translate(locale, "Manage catalog", "إدارة المنتجات")}</Link>
        <Link href="/notifications" aria-label={translate(locale, "Notifications", "الإشعارات")} className="grid size-10 place-items-center rounded-full border border-white/80 bg-[#dce9ee] text-[#385a70] shadow-[0_4px_12px_rgba(38,65,84,.12),inset_0_1px_0_white] transition hover:-translate-y-0.5"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></Link>
        <Link href="/account" aria-label={translate(locale, "Account", "الحساب")} className="grid size-10 place-items-center rounded-full border border-white/80 bg-[linear-gradient(145deg,#a9d9d4,#6ba9ae)] text-[#23485a] shadow-[0_4px_12px_rgba(38,65,84,.12),inset_0_1px_0_rgba(255,255,255,.8)]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5"/></svg></Link>
      </div>
    </header>
  );
}
