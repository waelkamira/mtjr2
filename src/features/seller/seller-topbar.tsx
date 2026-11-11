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
    : pathname.startsWith("/seller/settings") ? translate(locale, "Store settings", "إعدادات المتجر")
    : pathname.startsWith("/seller/finance") ? translate(locale, "Financial overview", "الملخص المالي")
    : pathname.startsWith("/seller/commissions") ? translate(locale, "Commission statements", "كشوف العمولات")
    : pathname.startsWith("/seller/payouts") ? translate(locale, "Bank accounts", "الحسابات البنكية")
    : translate(locale, "Seller studio", "استوديو البائع");

  return (
    <header className="seller-topbar static z-auto flex min-h-[var(--dashboard-topbar-height)] flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#101116] px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,.22)] sm:px-6 lg:px-8 xl:h-[var(--dashboard-topbar-height)] xl:flex-nowrap">
      <div className="min-w-0 flex-1 sm:flex-none">
        <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/45">{translate(locale, "MATJAR / SELLER STUDIO", "متجر / استوديو البائع")}</p>
        <p className="mt-1 break-words text-sm font-black text-white sm:text-base">{section}</p>
      </div>
      <form action="/seller/products" method="GET" role="search" dir="ltr" className={`order-3 flex w-full max-w-none flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white/65 shadow-[inset_0_1px_3px_rgba(0,0,0,.2)] xl:order-none xl:mx-6 xl:max-w-[440px] ${locale === "ar" ? "flex-row" : "flex-row-reverse"}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5 shrink-0"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
        <input dir={locale} name="search" aria-label={translate(locale, "Search products", "ابحث عن المنتجات")} placeholder={translate(locale, "Search products, SKU…", "ابحث عن المنتجات أو رمز SKU...")} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
        <button type="submit" data-variant="primary" className="rounded-xl bg-[var(--action)] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_9px_rgba(255,140,28,.18)] transition-colors hover:bg-[var(--action-hover)]">{translate(locale, "Search", "بحث")}</button>
      </form>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link href="/seller/products" className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white/80 shadow-[0_3px_10px_rgba(0,0,0,.15)] transition hover:border-amber-400/30 hover:bg-white/[0.07] hover:text-white sm:inline-flex"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M4 5.5h16v13H4z"/><path d="M8 9h8M8 13h5"/></svg>{translate(locale, "Manage catalog", "إدارة المنتجات")}</Link>
        <Link href="/notifications" aria-label={translate(locale, "Notifications", "الإشعارات")} className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-amber-300 shadow-[0_4px_12px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-amber-400/30"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></Link>
        <Link href="/account" aria-label={translate(locale, "Account", "الحساب")} className="grid size-10 place-items-center rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300 shadow-[0_4px_12px_rgba(0,0,0,.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5"/></svg></Link>
      </div>
    </header>
  );
}
