"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const groups = [
  {
    title: "Workspace",
    ar: "مساحة العمل",
    links: [
      { href: "/seller", label: "Overview", ar: "نظرة عامة", icon: "⌂" },
      { href: "/seller/products", label: "Products", ar: "المنتجات", icon: "▦" },
      { href: "/seller/orders", label: "Orders", ar: "الطلبات", icon: "▤" },
      { href: "/seller/inventory", label: "Inventory", ar: "المخزون", icon: "▥" }
    ]
  },
  {
    title: "Customer operations",
    ar: "عمليات العملاء",
    links: [
      { href: "/seller/returns", label: "Returns", ar: "المرتجعات", icon: "↶" },
      { href: "/seller/messages", label: "Messages", ar: "الرسائل", icon: "✉" },
      { href: "/seller/questions", label: "Product questions", ar: "أسئلة المنتجات", icon: "?" },
      { href: "/seller/reviews", label: "Reviews", ar: "التقييمات", icon: "★" }
    ]
  },
  {
    title: "Growth & team",
    ar: "النمو والفريق",
    links: [
      { href: "/seller/advertising", label: "Advertising", ar: "الإعلانات", icon: "↗" },
      { href: "/seller/staff", label: "Team & access", ar: "الفريق والصلاحيات", icon: "♙" },
      { href: "/notifications", label: "Notifications", ar: "الإشعارات", icon: "♧" }
    ]
  }
];

export default function SellerNavigation() {
  const pathname = usePathname();
  const { locale } = useLocale();

  return (
    <>
      <aside className="hidden min-h-screen w-[264px] shrink-0 flex-col border-r border-[var(--border)] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-[var(--border)] px-6 py-6">
          <Link href="/seller" className="text-2xl font-black tracking-tight text-[var(--color-onyx)]">
            mtjr<span className="text-[var(--color-copper-600)]">.</span>
          </Link>
          <p className="mt-1 text-xs font-medium text-[var(--muted)]">{translate(locale, "Seller workspace", "مركز البائع")}</p>
        </div>
        <nav aria-label={translate(locale, "Seller navigation", "تنقل البائع")} className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{translate(locale, group.title, group.ar)}</h2>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const active = link.href === "/seller"
                    ? pathname === "/seller"
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active
                        ? "bg-[var(--color-copper-100)] font-semibold text-[var(--color-onyx)] ring-1 ring-[var(--color-copper-600)]/20"
                        : "text-[var(--color-ink-700)] hover:bg-[var(--background)] hover:text-[var(--color-onyx)]"}`}>
                      <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-lg text-base ${active ? "bg-white text-[var(--color-copper-600)]" : "bg-[var(--background)] text-[var(--muted)]"}`}>{link.icon}</span>
                      <span>{translate(locale, link.label, link.ar)}</span>
                      {active && <span className="ms-auto size-1.5 rounded-full bg-[var(--color-copper-600)]" />}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="border-t border-[var(--border)] p-4">
          <Link href="/" className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--color-onyx)]">
            <span>{translate(locale, "View marketplace", "عرض واجهة المتجر")}</span><span aria-hidden="true">↗</span>
          </Link>
        </div>
      </aside>
      <div className="border-b border-[var(--border)] bg-white px-4 py-3 lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/seller" className="text-xl font-black text-[var(--color-onyx)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/" className="text-xs font-semibold text-[var(--muted)]">{translate(locale, "Marketplace", "المتجر")} ↗</Link>
        </div>
        <nav aria-label={translate(locale, "Seller navigation", "تنقل البائع")} className="flex gap-2 overflow-x-auto pb-1">
          {groups.flatMap((group) => group.links).map((link) => {
            const active = link.href === "/seller" ? pathname === "/seller" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${active ? "bg-[var(--color-onyx)] text-white" : "bg-[var(--background)] text-[var(--color-ink-700)]"}`}>
              {translate(locale, link.label, link.ar)}
            </Link>;
          })}
        </nav>
      </div>
    </>
  );
}
