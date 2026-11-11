"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export type SellerIconName = "home" | "package" | "orders" | "inventory" | "returns" | "messages" | "questions" | "reviews" | "ads" | "team" | "notifications" | "shipping" | "finance" | "user" | "business" | "catalog" | "pin" | "globe" | "document" | "shield" | "media" | "tag" | "store" | "plus" | "edit" | "trash" | "check" | "close" | "warehouse" | "refresh" | "arrow-up" | "arrow-down";
type Tone = "lavender" | "mint" | "peach" | "butter" | "blush" | "sky";

const groups: Array<{
  title: string; ar: string;
  links: Array<{ href: string; label: string; ar: string; icon: SellerIconName; tone: Tone }>;
}> = [
  {
    title: "Overview", ar: "الرئيسية",
    links: [
      { href: "/seller", label: "Dashboard", ar: "لوحة التحكم", icon: "home", tone: "lavender" }
    ]
  },
  {
    title: "Catalog", ar: "إدارة الكتالوج",
    links: [
      { href: "/seller/products", label: "Products", ar: "المنتجات", icon: "package", tone: "mint" },
      { href: "/seller/inventory", label: "Inventory", ar: "المخزون", icon: "inventory", tone: "butter" }
    ]
  },
  {
    title: "Sales & fulfillment", ar: "المبيعات والتنفيذ",
    links: [
      { href: "/seller/orders", label: "Orders", ar: "الطلبات", icon: "orders", tone: "peach" },
      { href: "/seller/shipping", label: "Shipping", ar: "الشحن والتوصيل", icon: "shipping", tone: "sky" },
      { href: "/seller/returns", label: "Returns", ar: "المرتجعات", icon: "returns", tone: "blush" }
    ]
  },
  {
    title: "Customer experience", ar: "تجربة العملاء",
    links: [
      { href: "/seller/messages", label: "Messages", ar: "الرسائل", icon: "messages", tone: "sky" },
      { href: "/seller/questions", label: "Product questions", ar: "أسئلة المنتجات", icon: "questions", tone: "lavender" },
      { href: "/seller/reviews", label: "Reviews", ar: "التقييمات", icon: "reviews", tone: "butter" }
    ]
  },
  {
    title: "Growth", ar: "النمو والتسويق",
    links: [
      { href: "/seller/advertising", label: "Advertising", ar: "الإعلانات والحملات", icon: "ads", tone: "peach" },
      { href: "/notifications", label: "Notifications", ar: "الإشعارات", icon: "notifications", tone: "blush" }
    ]
  },
  {
    title: "Finance", ar: "الشؤون المالية",
    links: [
      { href: "/seller/finance", label: "Financial overview", ar: "الملخص المالي", icon: "finance", tone: "lavender" },
      { href: "/seller/commissions", label: "Commission statements", ar: "كشوف العمولات", icon: "document", tone: "sky" },
      { href: "/seller/payouts", label: "Payout accounts", ar: "حسابات السحب", icon: "business", tone: "mint" }
    ]
  },
  {
    title: "Store & team", ar: "المتجر والفريق",
    links: [
      { href: "/seller/settings", label: "Store settings", ar: "إعدادات المتجر", icon: "store", tone: "lavender" },
      { href: "/seller/staff", label: "Team & access", ar: "الفريق والصلاحيات", icon: "team", tone: "mint" }
    ]
  }
];

const toneClasses: Record<Tone, string> = {
  lavender: "bg-[#f5f5f5] text-[#626262]",
  mint: "bg-[#f5f5f5] text-[#626262]",
  peach: "bg-[#f5f5f5] text-[#626262]",
  butter: "bg-[#f5f5f5] text-[#626262]",
  blush: "bg-[#f5f5f5] text-[#626262]",
  sky: "bg-[#f5f5f5] text-[#626262]"
};

export function SellerIcon({ name }: { name: SellerIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" {...common}>
      {name === "home" && <><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9 20v-6h6v6" /></>}
      {name === "package" && <><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.5 8.2-4.5M12 12.2V21M8 5.2l8.3 4.5" /></>}
      {name === "orders" && <><path d="M6 3.5h9l3 3V21H6z" /><path d="M14.5 3.5V7h3.5M9 11h6M9 15h6M9 18h3" /></>}
      {name === "inventory" && <><path d="m12 3 8 4.2v9.5L12 21l-8-4.3V7.2L12 3Z" /><path d="m4.3 7.5 7.7 4.2 7.7-4.2M12 11.7V21" /></>}
      {name === "returns" && <><path d="M4 8V4m0 0h4M4 4l4.2 4.2A8 8 0 1 1 4 13" /><path d="M8 13h5l-2-2m2 2-2 2" /></>}
      {name === "messages" && <><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 10h8M8 13.5h5" /></>}
      {name === "questions" && <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 4.3 1.5c-1.2 1.2-2 1.4-2 3M12 17h.01" /></>}
      {name === "reviews" && <><path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9L12 3Z" /></>}
      {name === "ads" && <><path d="M4 14V9l12-4v13L4 14Z" /><path d="m7 14 2 6h3l-2-5M19 9l2-2M19 14l2 2" /></>}
      {name === "team" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M17 15a4.5 4.5 0 0 1 3.5 4.4V20" /></>}
      {name === "notifications" && <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>}
      {name === "shipping" && <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7.5" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></>}
      {name === "finance" && <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h5M8 16h8" /></>}
      {name === "user" && <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>}
      {name === "business" && <><path d="M4 20V5l8-2v17M12 9h8v11M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2M3 20h18" /></>}
      {name === "catalog" && <><path d="M4 5.5h16v13H4z" /><path d="m5 17 4-4 3 3 2-2 5 4M9 9h.01" /></>}
      {name === "pin" && <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></>}
      {name === "globe" && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>}
      {name === "document" && <><path d="M6 3.5h8l4 4V21H6z" /><path d="M14 3.5V8h4M9 12h6M9 16h6" /></>}
      {name === "shield" && <><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>}
      {name === "media" && <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></>}
      {name === "tag" && <><path d="M20 13 13 20 4 11V4h7z" /><circle cx="8" cy="8" r="1" /></>}
      {name === "store" && <><path d="M4 10v10h16V10M3 10l2-6h14l2 6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6" /></>}
      {name === "plus" && <><path d="M12 5v14M5 12h14" /></>}
      {name === "edit" && <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" /><path d="m13.8 6.7 3.5 3.5" /></>}
      {name === "trash" && <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>}
      {name === "check" && <><path d="m5 12 4 4L19 6" /></>}
      {name === "close" && <><path d="m6 6 12 12M18 6 6 18" /></>}
      {name === "warehouse" && <><path d="m3 10 9-7 9 7v10H3z" /><path d="M8 20v-6h8v6M7 10h.01M12 10h.01M17 10h.01" /></>}
      {name === "refresh" && <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>}
      {name === "arrow-up" && <><path d="M12 19V5M5 12l7-7 7 7" /></>}
      {name === "arrow-down" && <><path d="M12 5v14M19 12l-7 7-7-7" /></>}
    </svg>
  );
}

type SidebarStore = { id: string; name: string; slug: string; logoUrl: string | null };

export default function SellerNavigation() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [store, setStore] = useState<SidebarStore | null>(null);

  useEffect(() => {
    let active = true;
    const loadActiveStore = () => {
      fetch("/api/seller/stores", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return await response.json() as { stores?: SidebarStore[] };
        })
        .then((data) => {
          if (!active) return;
          const available = data?.stores ?? [];
          let preferredId = "";
          try { preferredId = localStorage.getItem("mtjr.activeStoreId") ?? ""; } catch { /* Storage may be unavailable. */ }
          setStore(available.find((item) => item.id === preferredId) ?? available[0] ?? null);
        })
        .catch(() => undefined);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "mtjr.activeStoreId") loadActiveStore();
    };
    loadActiveStore();
    window.addEventListener("mtjr:active-store-changed", loadActiveStore);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("mtjr:active-store-changed", loadActiveStore);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <>
      <aside className="seller-sidebar relative z-30 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-e border-[#e8e5e0] bg-white text-[#454545] shadow-[8px_0_24px_rgba(69,69,69,.06)] lg:sticky lg:top-0 lg:flex">
        <div className="border-b border-[#eee9e4] px-6 py-7">
          <Link href="/seller" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#fff1e8] text-[#FF8C1C] shadow-[0_5px_12px_rgba(255,140,28,.12)]">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v8.5" /></svg>
            </span>
            <span>
              <span className="block text-[22px] font-black tracking-tight text-[#454545]">matjar<span className="text-[var(--orange)]">.</span></span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.18em] text-[#918a84]">{translate(locale, "Seller studio", "استوديو البائع")}</span>
            </span>
          </Link>
        </div>

        <div className="mx-4 mt-4 flex shrink-0 items-center gap-3 rounded-[1.25rem] border border-[#eee9e4] bg-white p-3 shadow-[0_5px_16px_rgba(48,38,78,.05)]">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[1.25rem] border border-[#f6d8c5] bg-[#fff1e8] text-xl font-black text-[#a94308] shadow-[inset_0_1px_0_white]">
            {store?.logoUrl ? <img src={store.logoUrl} alt="" className="size-full object-cover" /> : (store?.name ?? "M").trim().slice(0, 1).toLocaleUpperCase()}
          </span>
          <span className="min-w-0"><span className="block truncate text-sm font-extrabold text-[#454545]">{store?.name ?? translate(locale, "Your business", "أعمالك التجارية")}</span><span className="mt-1 block truncate text-[10px] leading-4 text-[#77716c]">{store ? `/stores/${store.slug}` : translate(locale, "One workspace for every store task", "مساحة واحدة لكل مهام متجرك")}</span></span>
        </div>


<nav
  aria-label={translate(locale, "Seller navigation", "تنقل البائع")}
  className="seller-sidebar-nav min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-4"
>
  {groups.map((group) => (
    <div key={group.title}>
      <div className="px-3 pb-1 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#918a84]">
          {translate(locale, group.title, group.ar)}
        </span>
      </div>

      <div className="space-y-0.5">
        {group.links.map((link) => {
          const active = link.href === "/seller"
            ? pathname === "/seller"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`group flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                active
                  ? "bg-[#ecfccb] font-semibold text-[#365314] shadow-[inset_3px_0_0_#84cc16]"
                  : "text-[#5f5a55] hover:bg-[#fff7ed] hover:text-[#454545] hover:shadow-[inset_0_0_0_1px_rgba(255,140,28,.22)]"
              }`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneClasses[link.tone]}`}>
                <SellerIcon name={link.icon} />
              </span>

              <span className="min-w-0 truncate">
                {translate(locale, link.label, link.ar)}
              </span>

              {active && (
                <span className="ms-auto size-2 shrink-0 rounded-full bg-[#65a30d]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  ))}
</nav>


        <div className="mx-3 mb-3 shrink-0 rounded-[1.25rem] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(48,38,78,.05)]">
          <span className="grid size-10 place-items-center rounded-xl border border-[#f6d8c5] bg-[#fff1e8] text-lg text-[#FF8C1C] shadow-[inset_0_1px_0_white]" aria-hidden="true">✦</span>
          <p className="mt-3 text-sm font-extrabold text-[#454545]">{translate(locale, "Grow your store", "طوّر متجرك")}</p>
          <p className="mt-1 text-[10px] leading-4 text-[#77716c]">{translate(locale, "Reach more customers with targeted campaigns.", "صل إلى عملاء أكثر عبر الحملات الموجّهة.")}</p>
          <Link href="/seller/advertising" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#FF8C1C] bg-[#FF8C1C] px-3 py-2 text-[11px] font-extrabold text-white shadow-[0_4px_12px_rgba(255,140,28,.16)]"><SellerIcon name="ads" />{translate(locale, "Explore campaigns", "استكشف الحملات")}</Link>
        </div>
        <div className="shrink-0 border-t border-[#eee9e4] p-4">
          <Link href="/" className="flex items-center justify-between rounded-2xl border border-[#eee9e4] bg-white px-4 py-3 text-sm font-semibold text-[#5f5a55] shadow-[0_3px_10px_rgba(48,38,78,.05)] transition hover:shadow-[var(--shadow-clay)]">
            <span className="flex items-center gap-2"><SellerIcon name="store" />{translate(locale, "View marketplace", "عرض واجهة المتجر")}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></svg>
          </Link>
          <p className="mt-3 px-2 text-[10px] leading-5 text-[#77716c]">{translate(locale, "One workspace for your products, orders and store operations.", "مساحة واحدة لمنتجاتك وطلباتك وعمليات متجرك.")}</p>
        </div>
      </aside>

      <div className="seller-mobile-navigation border-b border-[#eee9e4] bg-white px-4 py-3 text-[#454545] shadow-[0_4px_14px_rgba(69,69,69,.05)] lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/seller" className="flex items-center gap-2 text-xl font-black text-[#454545]">
            <span className="grid size-8 place-items-center rounded-xl border border-[#f6d8c5] bg-[#fff1e8] text-sm text-[#a94308] shadow-[0_4px_10px_rgba(255,140,28,.10),inset_0_2px_0_white]">m</span>
            matjar<span className="text-[var(--orange)]">.</span>
          </Link>
          <Link href="/" className="rounded-full border border-[#eee9e4] bg-white px-3 py-2 text-xs font-semibold text-[#454545] shadow-[0_4px_10px_rgba(74,75,112,.08),inset_0_1px_0_white]"><span className="inline-flex items-center gap-1"><SellerIcon name="store" />{translate(locale, "Marketplace", "المتجر")}</span></Link>
        </div>
        <nav aria-label={translate(locale, "Seller navigation", "تنقل البائع")} className="seller-mobile-navigation__links flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
          {groups.flatMap((group) => group.links).map((link) => {
            const active = link.href === "/seller" ? pathname === "/seller" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
              className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${active ? "border-[#a3e635] bg-[#d9f99d] text-[#365314]" : "border-[#eee9e4] bg-white text-[#454545] hover:border-[#f3b58f] hover:shadow-[0_4px_12px_rgba(255,140,28,.10)]"}`}>
              <SellerIcon name={link.icon} /><span>{translate(locale, link.label, link.ar)}</span>
            </Link>;
          })}
        </nav>
      </div>
    </>
  );
}
