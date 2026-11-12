"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import {
  LayoutDashboard, Users, Store, ShieldCheck, Package, Tags, Award,
  ShoppingCart, CreditCard, Building2, Truck, RotateCcw, Banknote,
  Headphones, MessageSquare, Star, HelpCircle, Search, Percent, Coins,
  Scale, BookOpen, Ticket, Megaphone, Shield, Crown, PanelLeftClose,
  PanelLeftOpen, Command, X
} from "lucide-react";

type AdminLink = { href: string; label: string; ar: string; icon: typeof LayoutDashboard; platformOnly?: boolean };
const groups: Array<{ label: string; ar: string; links: AdminLink[] }> = [
  { label: "Workspace", ar: "مساحة العمل", links: [
    { href: "/admin/dashboard", label: "Overview", ar: "نظرة عامة", icon: LayoutDashboard }
  ]},
  { label: "People & stores", ar: "المستخدمون والمتاجر", links: [
    { href: "/admin/users", label: "Users", ar: "المستخدمون", icon: Users },
    { href: "/admin/sellers", label: "Sellers & stores", ar: "البائعون والمتاجر", icon: Store }
  ]},
  { label: "Catalog", ar: "كتالوج المنتجات", links: [
    { href: "/admin/products", label: "Product approvals", ar: "اعتماد المنتجات", icon: ShieldCheck },
    { href: "/admin/product-management", label: "Product management", ar: "إدارة المنتجات", icon: Package },
    { href: "/admin/categories", label: "Categories", ar: "الفئات", icon: Tags },
    { href: "/admin/brands", label: "Brands", ar: "العلامات التجارية", icon: Award }
  ]},
  { label: "Commerce", ar: "التجارة والطلبات", links: [
    { href: "/admin/orders", label: "Orders", ar: "الطلبات", icon: ShoppingCart },
    { href: "/admin/payments", label: "Payments", ar: "المدفوعات", icon: CreditCard },
    { href: "/admin/logistics", label: "Shipments", ar: "الشحنات", icon: Truck },
    { href: "/admin/returns", label: "Returns", ar: "المرتجعات", icon: RotateCcw },
    { href: "/admin/refunds", label: "Refunds", ar: "استرداد المدفوعات", icon: Banknote }
  ]},
  { label: "Finance & growth", ar: "المالية والنمو", links: [
    { href: "/admin/commissions", label: "Commissions", ar: "العمولات", icon: Coins },
    { href: "/admin/tax-rates", label: "Tax rates", ar: "معدلات الضرائب", icon: Percent },
    { href: "/admin/coupons", label: "Discount codes", ar: "رموز الخصم", icon: Ticket },
    { href: "/admin/advertising", label: "Advertising review", ar: "مراجعة الإعلانات", icon: Megaphone },
    { href: "/admin/search-synonyms", label: "Search synonyms", ar: "مرادفات البحث", icon: Search }
  ]},
  { label: "Customer experience", ar: "تجربة العملاء", links: [
    { href: "/admin/support", label: "Customer support", ar: "دعم العملاء", icon: Headphones },
    { href: "/admin/reviews", label: "Product reviews", ar: "مراجعات المنتجات", icon: MessageSquare },
    { href: "/admin/store-reviews", label: "Store reviews", ar: "مراجعات المتاجر", icon: Star },
    { href: "/admin/questions", label: "Product Q&A", ar: "أسئلة وأجوبة المنتجات", icon: HelpCircle }
  ]},
  { label: "Platform controls", ar: "إعدادات المنصة", links: [
    { href: "/admin/payment-providers", label: "Payment providers", ar: "مزودو الدفع", icon: Building2, platformOnly: true },
    { href: "/admin/seller-payout-methods", label: "Seller payout verification", ar: "التحقق من حسابات البائعين", icon: Building2, platformOnly: true },
    { href: "/admin/financial-policies", label: "Financial policies", ar: "السياسات المالية", icon: Scale, platformOnly: true },
    { href: "/admin/finance/ledger", label: "General ledger", ar: "دفتر الأستاذ", icon: BookOpen, platformOnly: true },
    { href: "/admin/control-panel", label: "Super Admin", ar: "إدارة المنصة", icon: Crown, platformOnly: true }
  ]}
];

export default function AdminNavigation({ canManagePlatform = false }: { canManagePlatform?: boolean }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isArabic = locale === "ar";
  const visibleGroups = useMemo(() => groups.map((group) => ({
    ...group,
    links: group.links.filter((link) =>
      (!link.platformOnly || canManagePlatform) &&
      (!query.trim() || [link.label, link.ar, link.href].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())))
    )
  })).filter((group) => group.links.length), [canManagePlatform, query]);
  const activeHref = groups.flatMap((group) => group.links)
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <button type="button" onClick={() => setMobileOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-50 grid size-12 place-items-center rounded-full bg-[#202936] text-white shadow-xl lg:hidden"
        aria-label={translate(locale, "Toggle admin navigation", "فتح قائمة الإدارة")}>
        {mobileOpen ? <X size={20} /> : <Command size={20} />}
      </button>
      {mobileOpen && <button aria-label={translate(locale, "Close navigation", "إغلاق القائمة")} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />}
      <aside dir={isArabic ? "rtl" : "ltr"} className={`admin-sidebar fixed inset-y-0 z-40 flex h-dvh w-[min(88vw,290px)] flex-col border-slate-200 bg-[#202936] text-white shadow-2xl transition-all duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none ${isArabic ? "right-0 border-l" : "left-0 border-r"} ${mobileOpen ? "translate-x-0" : isArabic ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "lg:w-[84px]" : "lg:w-[276px]"}`}>
        <div className="flex min-h-[82px] items-center justify-between border-b border-white/10 px-5">
          <Link href="/admin/dashboard" onClick={() => setMobileOpen(false)} className={`flex min-w-0 items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FF8C1C] text-white shadow-lg shadow-orange-950/25"><Crown size={21} /></span>
            <span className={collapsed ? "lg:hidden" : ""}>
              <span className="block text-lg font-black tracking-wide">matjar<span className="text-[#FF8C1C]">.</span></span>
              <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">{translate(locale, "Platform administration", "إدارة المنصة")}</span>
            </span>
          </Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:block" aria-label={translate(locale, "Collapse sidebar", "طي القائمة")}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className={`border-b border-white/10 px-4 py-4 ${collapsed ? "lg:hidden" : ""}`}>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[.06] px-3 text-slate-400 focus-within:border-[#FF8C1C]/70 focus-within:ring-2 focus-within:ring-[#FF8C1C]/15">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate(locale, "Find an admin page…", "ابحث عن قسم إداري…")} className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500" />
          </label>
        </div>

        <nav aria-label={translate(locale, "Administration", "الإدارة")} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <h2 className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500 ${collapsed ? "lg:hidden" : ""}`}>{translate(locale, group.label, group.ar)}</h2>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const active = activeHref === link.href;
                  const Icon = link.icon;
                  return <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} title={collapsed ? translate(locale, link.label, link.ar) : undefined} aria-current={active ? "page" : undefined}
                    className={`group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${collapsed ? "lg:justify-center lg:px-0" : ""} ${active ? "bg-[#FF8C1C] text-white shadow-md shadow-orange-950/20" : "text-slate-300 hover:bg-white/[.07] hover:text-white"}`}>
                    <Icon size={17} className={active ? "shrink-0 text-white" : "shrink-0 text-slate-400 group-hover:text-[#FFB15F]"} />
                    <span className={collapsed ? "lg:hidden" : "min-w-0 flex-1 truncate"}>{translate(locale, link.label, link.ar)}</span>
                    {active && !collapsed && <span className="size-1.5 rounded-full bg-white" />}
                  </Link>;
                })}
              </div>
            </section>
          ))}
          {!visibleGroups.length && <p className="px-3 py-8 text-center text-xs text-slate-400">{translate(locale, "No matching admin pages", "لا توجد أقسام مطابقة")}</p>}
        </nav>

        <div className={`border-t border-white/10 p-4 ${collapsed ? "lg:px-2" : ""}`}>
          <div className={`flex items-center gap-3 rounded-xl bg-white/[.06] p-3 ${collapsed ? "lg:justify-center lg:p-2" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300"><Shield size={17} /></span>
            <span className={collapsed ? "lg:hidden" : "min-w-0"}>
              <span className="block text-xs font-semibold text-slate-200">{translate(locale, "Protected workspace", "مساحة عمل محمية")}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{translate(locale, "Role-based access · MFA", "صلاحيات حسب الدور · تحقق متعدد العوامل")}</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
