"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const navigation = [
  { href: "/seller", en: "Overview", ar: "نظرة عامة", mark: "01" },
  { href: "/seller/products", en: "Products", ar: "المنتجات", mark: "02" },
  { href: "/seller/orders", en: "Orders", ar: "الطلبات", mark: "03" },
  { href: "/seller/inventory", en: "Inventory", ar: "المخزون", mark: "04" },
  { href: "/seller/shipping", en: "Shipping", ar: "الشحن", mark: "05" },
  { href: "/seller/returns", en: "Returns", ar: "المرتجعات", mark: "06" },
  { href: "/seller/reviews", en: "Reviews", ar: "التقييمات", mark: "07" },
  { href: "/seller/questions", en: "Questions", ar: "الأسئلة", mark: "08" },
  { href: "/seller/messages", en: "Messages", ar: "الرسائل", mark: "09" },
  { href: "/seller/staff", en: "Team", ar: "الفريق", mark: "10" },
  { href: "/seller/advertising", en: "Advertising", ar: "الإعلانات", mark: "11" },
  { href: "/notifications", en: "Notifications", ar: "الإشعارات", mark: "12" }
] as const;

export default function SellerPortalShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = (en: string, ar: string) => translate(locale, en, ar);

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(214,207,246,.34),transparent_38%),radial-gradient(ellipse_at_top_right,rgba(188,231,218,.38),transparent_34%),linear-gradient(145deg,#f8f7fb,#f1f5f7_48%,#f8f4f5)]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-44 size-72 rounded-full bg-[#e5dcfa]/35 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-[38rem] size-80 rounded-full bg-[#d7eee7]/40 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-[1720px] gap-5 px-3 py-4 sm:px-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-7 lg:px-7 lg:py-7">
        <aside className="h-fit rounded-[30px] border border-white/90 bg-[linear-gradient(145deg,#f4f1fc,#e7e3f3)] p-3 shadow-[12px_14px_28px_rgba(77,69,108,.12),inset_0_2px_0_rgba(255,255,255,.98),inset_0_-3px_8px_rgba(93,82,128,.06)] lg:sticky lg:top-5">
          <div className="rounded-[23px] border border-white/80 bg-[linear-gradient(135deg,#6f668f,#9186b4)] px-4 py-5 text-white shadow-[0_9px_18px_rgba(89,79,126,.2),inset_0_1px_0_rgba(255,255,255,.3)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/70">{t("MATJAR SELLER CENTER", "مركز البائع في متجري")}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl border border-white/60 bg-white/20 text-xl font-black shadow-[inset_0_2px_0_rgba(255,255,255,.25)]">m.</span>
              <div><p className="text-lg font-black tracking-tight">matjar</p><p className="text-[11px] text-white/75">{t("Your business workspace", "مساحة إدارة نشاطك")}</p></div>
            </div>
          </div>

          <nav aria-label={t("Seller navigation", "قائمة البائع")} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {navigation.map((item) => {
              const active = item.href === "/seller" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                  className={active
                    ? "group flex min-h-12 items-center gap-3 rounded-2xl border border-white/95 bg-[linear-gradient(145deg,#d9d2f0,#c7bee7)] px-3 py-2.5 text-sm font-extrabold text-[#494166] shadow-[0_6px_13px_rgba(88,77,128,.13),inset_0_2px_0_white,inset_0_-2px_4px_rgba(87,73,126,.08)]"
                    : "group flex min-h-12 items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-semibold text-[#6f7187] transition hover:border-white/90 hover:bg-white/65 hover:text-[#494166] hover:shadow-[0_5px_12px_rgba(76,72,100,.07)]"}>
                  <span className={active ? "grid size-8 shrink-0 place-items-center rounded-xl bg-white/65 text-[10px] font-black text-[#665b91] shadow-[inset_0_1px_2px_rgba(75,65,112,.1)]" : "grid size-8 shrink-0 place-items-center rounded-xl bg-white/55 text-[10px] font-black text-[#9692aa]"}>{item.mark}</span>
                  <span className="truncate">{t(item.en, item.ar)}</span>
                  {active && <span aria-hidden="true" className="ms-auto size-1.5 shrink-0 rounded-full bg-[#74699e]" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 hidden rounded-2xl border border-white/90 bg-white/55 p-4 text-xs leading-5 text-[#77758b] shadow-[inset_0_1px_0_white] lg:block">
            <p className="font-extrabold text-[#57516f]">{t("Seller workspace", "مساحة البائع")}</p>
            <p className="mt-1">{t("Store data and actions are scoped by your active store permissions.", "تُعرض بيانات المتجر وإجراءاته وفق صلاحيات المتجر النشط.")}</p>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/90 bg-white/60 px-4 py-3 shadow-[0_7px_18px_rgba(82,79,105,.07),inset_0_1px_0_white] backdrop-blur-sm sm:px-5">
            <div className="min-w-[150px]"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9189aa]">{t("SELLER WORKSPACE", "مساحة عمل البائع")}</p><p className="mt-0.5 text-sm font-bold text-[#4e4b64]">{t("Manage your store from one place", "أدر متجرك من مكان واحد")}</p></div>
            <form action="/seller/products" method="GET" role="search" className="order-3 flex w-full min-w-0 flex-1 items-center gap-2 rounded-full border border-white/90 bg-[linear-gradient(145deg,#f4effa,#e2f1e9)] px-4 py-2 shadow-[inset_0_2px_5px_rgba(76,65,105,.08),0_1px_0_white] sm:order-none sm:max-w-[440px]">
              <label htmlFor="seller-global-search" className="sr-only">{t("Search products", "ابحث عن المنتجات")}</label>
              <input id="seller-global-search" name="search" maxLength={120} placeholder={t("Search products, SKU or barcode…", "ابحث عن منتج أو SKU أو باركود...")} className="min-w-0 flex-1 bg-transparent text-sm text-[#514a6d] outline-none placeholder:text-[#9189aa]" />
              <button type="submit" className="rounded-full bg-[linear-gradient(135deg,#8174a8,#665b8c)] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_3px_8px_rgba(76,65,105,.14)]">{t("Search", "بحث")}</button>
            </form>
            <Link href="/" className="rounded-full border border-white bg-white/75 px-4 py-2 text-xs font-bold text-[#6f6888] shadow-[0_3px_8px_rgba(70,65,91,.07)] transition hover:-translate-y-0.5">{t("View marketplace", "عرض السوق")} ↗</Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
