"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type IconName = "home" | "package" | "orders" | "inventory" | "returns" | "messages" | "questions" | "reviews" | "ads" | "team" | "notifications" | "shipping" | "finance";
type Tone = "lavender" | "mint" | "peach" | "butter" | "blush" | "sky";

const groups: Array<{
  title: string; ar: string;
  links: Array<{ href: string; label: string; ar: string; icon: IconName; tone: Tone }>;
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
      { href: "/seller/commissions", label: "Commission statements", ar: "كشوف العمولات", icon: "finance", tone: "sky" }
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

const toneClasses: Record<Tone, string> = {
  lavender: "bg-[var(--color-lavender-100)] text-[var(--color-lavender-800)]",
  mint: "bg-[var(--color-mint-100)] text-[var(--color-mint-800)]",
  peach: "bg-[var(--color-peach-100)] text-[var(--color-peach-800)]",
  butter: "bg-[var(--color-butter-100)] text-[var(--color-butter-800)]",
  blush: "bg-[var(--color-blush-100)] text-[var(--color-blush-800)]",
  sky: "bg-[var(--color-sky-100)] text-[var(--color-sky-700)]"
};

function SellerIcon({ name }: { name: IconName }) {
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
      <aside className="relative z-30 hidden h-screen w-[280px] shrink-0 flex-col overflow-hidden border-e border-[#263b52] bg-[#1d3248] text-[#edf4f7] shadow-[8px_0_24px_rgba(12,28,45,.16)] lg:sticky lg:top-0 lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <Link href="/seller" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--color-lavender-100)] text-[var(--color-lavender-800)] shadow-[var(--shadow-clay)]">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v8.5" /></svg>
            </span>
            <span>
              <span className="block text-[22px] font-black tracking-tight text-[#f0f6fa]">matjar<span className="text-[var(--orange)]">.</span></span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.18em] text-[#a9c0cf]">{translate(locale, "Seller studio", "استوديو البائع")}</span>
            </span>
          </Link>
        </div>

        <div className="mx-4 mt-4 flex shrink-0 items-center gap-3 rounded-[1.25rem] border border-white/15 bg-[linear-gradient(145deg,#314c65,#263d55)] p-3 shadow-[8px_10px_20px_rgba(5,17,31,.25),inset_0_1px_0_rgba(255,255,255,.16)]">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[1.25rem] border border-white/35 bg-[linear-gradient(145deg,#d8edf0,#9fc8d2)] text-xl font-black text-[#29475b] shadow-[0_7px_16px_rgba(9,24,38,.2),inset_0_2px_0_white]">
            {store?.logoUrl ? <img src={store.logoUrl} alt="" className="size-full object-cover" /> : (store?.name ?? "M").trim().slice(0, 1).toLocaleUpperCase()}
          </span>
          <span className="min-w-0"><span className="block truncate text-sm font-extrabold text-white">{store?.name ?? translate(locale, "Your business", "أعمالك التجارية")}</span><span className="mt-1 block truncate text-[10px] leading-4 text-[#b3c6d2]">{store ? `/stores/${store.slug}` : translate(locale, "One workspace for every store task", "مساحة واحدة لكل مهام متجرك")}</span></span>
        </div>

        <nav aria-label={translate(locale, "Seller navigation", "تنقل البائع")} className="min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-4 py-5">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.17em] text-[#8fa9ba]">{translate(locale, group.title, group.ar)}</h2>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const active = link.href === "/seller"
                    ? pathname === "/seller"
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200 ${active
                        ? "bg-[linear-gradient(135deg,#9fd5d4,#78b8bd)] font-extrabold text-[#17374b] ring-1 ring-white/70 shadow-[0_8px_18px_rgba(5,17,31,.25),inset_0_2px_0_rgba(255,255,255,.8)]"
                        : "text-[#d1e0e8] hover:bg-white/10 hover:text-white"}`}>
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:-translate-y-0.5 ${toneClasses[link.tone]}`}>
                        <SellerIcon name={link.icon} />
                      </span>
                      <span>{translate(locale, link.label, link.ar)}</span>
                      {active && <span className="ms-auto size-2 rounded-full bg-[#f2c66d] shadow-[0_0_12px_rgba(242,198,109,.55)]" />}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="mx-4 mb-3 shrink-0 rounded-[1.25rem] border border-white/15 bg-[linear-gradient(145deg,#314c65,#263d55)] p-4 shadow-[8px_10px_20px_rgba(5,17,31,.25),inset_0_1px_0_rgba(255,255,255,.16)]">
          <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-[#9fd5d4]/20 text-lg text-[#a9dcd8] shadow-[inset_0_1px_0_rgba(255,255,255,.2)]" aria-hidden="true">✦</span>
          <p className="mt-3 text-sm font-extrabold text-white">{translate(locale, "Grow your store", "طوّر متجرك")}</p>
          <p className="mt-1 text-[10px] leading-4 text-[#b3c6d2]">{translate(locale, "Reach more customers with targeted campaigns.", "صل إلى عملاء أكثر عبر الحملات الموجّهة.")}</p>
          <Link href="/seller/advertising" className="mt-3 inline-flex rounded-full border border-white/25 bg-[linear-gradient(135deg,#9fd5d4,#78b8bd)] px-3 py-2 text-[11px] font-extrabold text-[#17374b] shadow-[0_5px_12px_rgba(5,17,31,.22),inset_0_1px_0_white]">{translate(locale, "Explore campaigns", "استكشف الحملات")} ↗</Link>
        </div>
        <div className="shrink-0 border-t border-white/10 p-4">
          <Link href="/" className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-[#eaf3f7] shadow-[6px_7px_16px_rgba(5,17,31,.18),inset_0_1px_0_rgba(255,255,255,.12)] transition hover:shadow-[var(--shadow-clay)]">
            <span>{translate(locale, "View marketplace", "عرض واجهة المتجر")}</span><span aria-hidden="true">↗</span>
          </Link>
          <p className="mt-3 px-2 text-[10px] leading-5 text-[#9fb5c4]">{translate(locale, "One workspace for your products, orders and store operations.", "مساحة واحدة لمنتجاتك وطلباتك وعمليات متجرك.")}</p>
        </div>
      </aside>

      <div className="border-b border-white/10 bg-[linear-gradient(180deg,#20364d,#172b40)] px-4 py-3 text-[#eaf3f7] shadow-[0_8px_22px_rgba(74,75,112,.10)] lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/seller" className="flex items-center gap-2 text-xl font-black text-[#f0f6fa]">
            <span className="grid size-8 place-items-center rounded-xl border border-white/20 bg-[linear-gradient(145deg,#9fd5d4,#78b8bd)] text-sm text-[#17374b] shadow-[0_4px_10px_rgba(93,83,139,.12),inset_0_2px_0_white]">m</span>
            matjar<span className="text-[var(--orange)]">.</span>
          </Link>
          <Link href="/" className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-[0_4px_10px_rgba(74,75,112,.08),inset_0_1px_0_white]">{translate(locale, "Marketplace", "المتجر")} ↗</Link>
        </div>
        <nav aria-label={translate(locale, "Seller navigation", "تنقل البائع")} className="flex max-h-28 flex-wrap gap-2 overflow-x-hidden overflow-y-auto overscroll-contain pb-1">
          {groups.flatMap((group) => group.links).map((link) => {
            const active = link.href === "/seller" ? pathname === "/seller" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
              className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${active ? "bg-[linear-gradient(135deg,#9fd5d4,#78b8bd)] text-[#17374b] ring-1 ring-white/70 shadow-[0_5px_14px_rgba(5,17,31,.22),inset_0_2px_0_white]" : "bg-white/10 text-[#d1e0e8] hover:bg-white/20"}`}>
              <SellerIcon name={link.icon} /><span>{translate(locale, link.label, link.ar)}</span>
            </Link>;
          })}
        </nav>
      </div>
    </>
  );
}
