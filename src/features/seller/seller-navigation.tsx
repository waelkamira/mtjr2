
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export type SellerIconName =
  | "home" | "package" | "orders" | "inventory" | "returns" | "messages"
  | "questions" | "reviews" | "ads" | "team" | "notifications" | "shipping"
  | "finance" | "user" | "business" | "catalog" | "pin" | "globe"
  | "document" | "shield" | "media" | "tag" | "store" | "plus" | "edit"
  | "trash" | "check" | "close" | "warehouse" | "refresh" | "arrow-up" | "arrow-down" | "sliders";

type Tone = "lavender" | "mint" | "peach" | "butter" | "blush" | "sky";

const groups: Array<{
  title: string; ar: string;
  links: Array<{ href: string; label: string; ar: string; icon: SellerIconName; tone: Tone }>;
}> = [
  {
    title: "Workspace", ar: "مساحة العمل",
    links: [
      { href: "/seller", label: "Overview", ar: "نظرة عامة", icon: "home", tone: "lavender" },
      { href: "/seller/products", label: "Products", ar: "المنتجات", icon: "package", tone: "mint" },
      { href: "/seller/orders", label: "Orders", ar: "الطلبات", icon: "orders", tone: "peach" },
      { href: "/seller/inventory", label: "Inventory", ar: "المخزون", icon: "inventory", tone: "butter" },
      { href: "/seller/shipping", label: "Shipping", ar: "الشحن", icon: "shipping", tone: "sky" },
      { href: "/seller/settings", label: "Store settings", ar: "إعدادات المتجر", icon: "home", tone: "lavender" }
    ]
  },
  {
    title: "Finance", ar: "المالية",
    links: [
      { href: "/seller/finance", label: "Financial overview", ar: "الملخص المالي", icon: "finance", tone: "lavender" },
      { href: "/seller/commissions", label: "Commission statements", ar: "كشوف العمولات", icon: "finance", tone: "sky" },
      { href: "/seller/payouts", label: "Bank accounts", ar: "الحسابات البنكية", icon: "finance", tone: "mint" }
    ]
  },
  {
    title: "Customer operations", ar: "عمليات العملاء",
    links: [
      { href: "/seller/returns", label: "Returns", ar: "المرتجعات", icon: "returns", tone: "blush" },
      { href: "/seller/messages", label: "Messages", ar: "الرسائل", icon: "messages", tone: "sky" },
      { href: "/seller/questions", label: "Product questions", ar: "أسئلة المنتجات", icon: "questions", tone: "lavender" },
      { href: "/seller/reviews", label: "Reviews", ar: "التقييمات", icon: "reviews", tone: "butter" }
    ]
  },
  {
    title: "Growth & team", ar: "النمو والفريق",
    links: [
      { href: "/seller/advertising", label: "Advertising", ar: "الإعلانات", icon: "ads", tone: "peach" },
      { href: "/seller/staff", label: "Team & access", ar: "الفريق والصلاحيات", icon: "team", tone: "mint" },
      { href: "/notifications", label: "Notifications", ar: "الإشعارات", icon: "notifications", tone: "blush" }
    ]
  }
];

// Luxury tone gradients - each tone gets a refined gradient treatment
const toneClasses: Record<Tone, string> = {
  lavender: "bg-gradient-to-br from-violet-500/20 to-purple-600/10 text-violet-300 ring-1 ring-violet-400/20",
  mint:     "bg-gradient-to-br from-emerald-500/20 to-teal-600/10 text-emerald-300 ring-1 ring-emerald-400/20",
  peach:    "bg-gradient-to-br from-orange-500/20 to-amber-600/10 text-orange-300 ring-1 ring-orange-400/20",
  butter:   "bg-gradient-to-br from-yellow-500/20 to-amber-500/10 text-yellow-300 ring-1 ring-yellow-400/20",
  blush:    "bg-gradient-to-br from-rose-500/20 to-pink-600/10 text-rose-300 ring-1 ring-rose-400/20",
  sky:      "bg-gradient-to-br from-sky-500/20 to-blue-600/10 text-sky-300 ring-1 ring-sky-400/20"
};

export function SellerIcon({ name }: { name: SellerIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
      {name === "sliders" && <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="18" r="2" /></>}
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

  // Select only the most specific matching route so parent and child
  // navigation entries cannot appear active at the same time.
  const activeHref = groups
    .flatMap((group) => group.links)
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Group links by their parent group for the sidebar (with section titles)
  const groupedNav = groups.map((group) => ({
    ...group,
    renderedLinks: group.links.map((link) => ({
      ...link,
      active: activeHref === link.href
    }))
  }));

  return (
    <>
      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside className="seller-sidebar relative z-30 hidden h-screen max-h-screen w-72 shrink-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain border-e border-white/5 bg-[#0B0B10] text-white shadow-[20px_0_60px_-20px_rgba(0,0,0,.6)] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.18)_transparent] lg:sticky lg:top-0 lg:flex">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
        </div>

        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }}
        />

        {/* Brand header */}
        <div className="relative border-b border-white/5 px-6 py-7 backdrop-blur-sm">
          <Link href="/seller" className="group flex items-center gap-3">
            <span className="relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-[0_8px_24px_rgba(251,146,60,.35),inset_0_1px_0_rgba(255,255,255,.3)] transition-transform duration-300 group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
                <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v8.5" />
              </svg>
              <span className="absolute inset-0 rounded-2xl ring-1 ring-white/20" />
            </span>
            <span className="min-w-0">
              <span className="block text-[22px] font-black tracking-tight text-white">
                matjar<span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">.</span>
              </span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.22em] text-white/55">
                {translate(locale, "Seller studio", "استوديو البائع")}
              </span>
            </span>
          </Link>
        </div>

        {/* Store selector card */}
        <div className="relative mx-4 mt-5 shrink-0">
          <div className="relative overflow-hidden rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_8px_22px_rgba(69,69,69,.08)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#fff6ef]/70 via-transparent to-[#fff1e8]/60" />
            <div className="relative flex items-center gap-3">
              <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#f6d8c5] bg-[#fff1e8] text-lg font-black text-[#FF8C1C] shadow-[inset_0_1px_0_white]">
                {store?.logoUrl ? (
                  <img src={store.logoUrl} alt="" className="size-full object-cover" />
                ) : (
                  (store?.name ?? "M").trim().slice(0, 1).toLocaleUpperCase()
                )}
                <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-[#f6d8c5]/70" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#454545]">
                  {store?.name ?? translate(locale, "Your business", "أعمالك التجارية")}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#777777]">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.6)]" />
                  <span className="truncate font-mono">
                    {store ? `/${store.slug}` : translate(locale, "Active workspace", "مساحة نشطة")}
                  </span>
                </span>
              </span>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#eee9e4] bg-[#fffaf6] text-[#777777] transition hover:border-[#f6d8c5] hover:bg-[#fff1e8] hover:text-[#FF8C1C]"
                aria-label={translate(locale, "Switch store", "تبديل المتجر")}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          aria-label={translate(locale, "Seller navigation", "تنقل البائع")}
          className="seller-sidebar-nav relative flex-none space-y-6 overflow-visible px-4 py-6"
        >
          {groupedNav.map((group, gIdx) => (
            <div key={group.title}>
              <div className="mb-2 flex items-center gap-2 px-3">
                <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                <span className="text-[9px] font-bold uppercase tracking-[.25em] text-white/45">
                  {translate(locale, group.title, group.ar)}
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
              </div>
              <div className="space-y-1">
                {group.renderedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={link.active ? "page" : undefined}
                    className={`group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${
                      link.active
                        ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(251,191,36,.2)]"
                        : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {/* Active indicator bar */}
                    {link.active && (
                      <span className="absolute start-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-e-full bg-gradient-to-b from-amber-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,.6)]" />
                    )}

                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${
                        link.active
                          ? "bg-gradient-to-br from-amber-400/30 to-orange-500/20 text-amber-300 ring-1 ring-amber-400/40 shadow-[0_4px_12px_rgba(251,191,36,.2)]"
                          : toneClasses[link.tone]
                      }`}
                    >
                      <SellerIcon name={link.icon} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {translate(locale, link.label, link.ar)}
                    </span>
                    {link.active && (
                      <span className="relative shrink-0">
                        <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/40" />
                        <span className="relative block size-2 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_0_8px_rgba(251,191,36,.8)]" />
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Promotional card */}
        <div className="relative mx-4 mb-3 shrink-0">
          <div className="relative overflow-hidden rounded-2xl border border-[#f6d8c5] bg-gradient-to-br from-[#fff6ef] via-white to-[#fff1e8] p-4 shadow-[0_8px_22px_rgba(69,69,69,.07)]">
            {/* Decorative shimmer */}
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#f6d8c5]/35 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#fff1e8]/80 blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_4px_12px_rgba(251,146,60,.4)]">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9L12 3Z" />
                  </svg>
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[.25em] text-[#a65b26]">
                  {translate(locale, "Premium", "مميز")}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-[#454545]">
                {translate(locale, "Grow your store", "طوّر متجرك")}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[#777777]">
                {translate(locale, "Reach more customers with targeted campaigns.", "صل إلى عملاء أكثر عبر الحملات الموجّهة.")}
              </p>
              <Link
                href="/seller/advertising"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-2 text-[11px] font-bold text-white shadow-[0_4px_16px_rgba(251,146,60,.4)] transition-all hover:shadow-[0_6px_20px_rgba(251,146,60,.6)] hover:brightness-110"
              >
                <SellerIcon name="ads" />
                {translate(locale, "Explore campaigns", "استكشف الحملات")}
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative shrink-0 border-t border-white/5 p-4 backdrop-blur-sm">
          <Link
            href="/"
            className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/75 transition-all hover:border-amber-400/30 hover:bg-amber-500/5 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-white/75 transition group-hover:bg-amber-500/10 group-hover:text-amber-300">
                <SellerIcon name="store" />
              </span>
              {translate(locale, "View marketplace", "عرض واجهة المتجر")}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            >
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </Link>
          <p className="mt-3 px-2 text-[10px] leading-5 text-white/45">
            {translate(locale, "One workspace for your products, orders and store operations.", "مساحة واحدة لمنتجاتك وطلباتك وعمليات متجرك.")}
          </p>
        </div>
      </aside>

      {/* ============ MOBILE NAVIGATION ============ */}
      <div className="seller-mobile-navigation border-b border-white/5 bg-[#0B0B10] px-4 py-3 text-white shadow-[0_4px_20px_rgba(0,0,0,.4)] lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/seller" className="flex items-center gap-2 text-xl font-black text-white">
            <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-sm font-black text-white shadow-[0_4px_12px_rgba(251,146,60,.4)]">
              m
            </span>
            matjar<span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">.</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur-sm transition hover:border-amber-400/30 hover:text-amber-300"
          >
            <span className="inline-flex items-center gap-1.5">
              <SellerIcon name="store" />
              {translate(locale, "Marketplace", "المتجر")}
            </span>
          </Link>
        </div>
        <nav
          aria-label={translate(locale, "Seller navigation", "تنقل البائع")}
          className="seller-mobile-navigation__links flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.flatMap((group) => group.links).map((link) => {
            const active = link.href === "/seller"
              ? pathname === "/seller"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  active
                    ? "border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-200 shadow-[0_4px_16px_rgba(251,146,60,.2)]"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:border-amber-400/20 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-md ${
                  active
                    ? "bg-amber-400/20 text-amber-300"
                    : toneClasses[link.tone]
                }`}>
                  <SellerIcon name={link.icon} />
                </span>
                <span>{translate(locale, link.label, link.ar)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}