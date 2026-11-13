"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import {
  LayoutDashboard, Users, Store, ShieldCheck, Package, Tags, Award,
  ShoppingCart, CreditCard, Building2, Truck, RotateCcw, Banknote,
  Headphones, MessageSquare, Star, HelpCircle, Search, Percent, Coins,
  Scale, BookOpen, Ticket, Megaphone, Shield, Crown, PanelLeftClose,
  PanelLeftOpen, Command, X, ClipboardList, FileText, KeyRound, Bot
} from "lucide-react";

type AdminLink = {
  href: string;
  label: string;
  ar: string;
  icon: typeof LayoutDashboard;
  platformOnly?: boolean;
};

const linkPermissions: Record<string, string[]> = {
  "/admin/dashboard": ["users:manage", "payments:read", "catalog:read", "returns:manage", "platform:manage"],
  "/admin/users": ["users:manage"], "/admin/sellers": ["users:manage"],
  "/admin/products": ["catalog:read"], "/admin/product-management": ["catalog:read", "catalog:manage"],
  "/admin/categories": ["catalog:read"], "/admin/brands": ["catalog:read"],
  "/admin/orders": ["users:manage"], "/admin/payments": ["payments:read", "payments:refund"],
  "/admin/logistics": ["orders:manage"], "/admin/returns": ["returns:manage"], "/admin/refunds": ["payments:refund"],
  "/admin/commissions": ["platform:manage"], "/admin/tax-rates": ["platform:manage"], "/admin/coupons": ["catalog:manage"],
  "/admin/advertising": ["ads:moderate"], "/admin/search-synonyms": ["catalog:manage"],
  "/admin/support": ["support:read", "support:manage"], "/admin/reviews": ["reviews:manage"],
  "/admin/store-reviews": ["reviews:manage"], "/admin/questions": ["users:manage"],
  "/admin/questions/reports": ["users:manage"], "/admin/review": ["reviews:manage"],
  "/admin/payment-providers": ["platform:manage"], "/admin/seller-payout-methods": ["platform:manage"],
  "/admin/financial-policies": ["platform:manage"], "/admin/finance/ledger": ["platform:manage"],
  "/admin/reports": ["platform:manage"], "/admin/control-panel": ["platform:manage"],
  "/admin/control-panel/access-catalog": ["platform:manage"], "/admin/control-panel/audit-log": ["platform:manage"],
  "/admin/control-panel/privilege-requests": ["platform:manage"], "/admin/control-panel/ai-assistant": ["platform:manage"]
};

const groups: Array<{ label: string; ar: string; links: AdminLink[] }> = [
  {
    label: "Workspace", ar: "مساحة العمل", links: [
      { href: "/admin/dashboard", label: "Overview", ar: "نظرة عامة", icon: LayoutDashboard }
    ]
  },
  {
    label: "People & stores", ar: "المستخدمون والمتاجر", links: [
      { href: "/admin/users", label: "Users", ar: "المستخدمون", icon: Users },
      { href: "/admin/sellers", label: "Sellers & stores", ar: "البائعون والمتاجر", icon: Store }
    ]
  },
  {
    label: "Catalog", ar: "كتالوج المنتجات", links: [
      { href: "/admin/products", label: "Product approvals", ar: "اعتماد المنتجات", icon: ShieldCheck },
      { href: "/admin/product-management", label: "Product management", ar: "إدارة المنتجات", icon: Package },
      { href: "/admin/categories", label: "Categories", ar: "الفئات", icon: Tags },
      { href: "/admin/brands", label: "Brands", ar: "العلامات التجارية", icon: Award }
    ]
  },
  {
    label: "Commerce", ar: "التجارة والطلبات", links: [
      { href: "/admin/orders", label: "Orders", ar: "الطلبات", icon: ShoppingCart },
      { href: "/admin/payments", label: "Payments", ar: "المدفوعات", icon: CreditCard },
      { href: "/admin/logistics", label: "Shipments", ar: "الشحنات", icon: Truck },
      { href: "/admin/returns", label: "Returns", ar: "المرتجعات", icon: RotateCcw },
      { href: "/admin/refunds", label: "Refunds", ar: "استرداد المدفوعات", icon: Banknote }
    ]
  },
  {
    label: "Finance & growth", ar: "المالية والنمو", links: [
      { href: "/admin/commissions", label: "Commissions", ar: "العمولات", icon: Coins },
      { href: "/admin/tax-rates", label: "Tax rates", ar: "معدلات الضرائب", icon: Percent },
      { href: "/admin/coupons", label: "Discount codes", ar: "رموز الخصم", icon: Ticket },
      { href: "/admin/advertising", label: "Advertising review", ar: "مراجعة الإعلانات", icon: Megaphone },
      { href: "/admin/search-synonyms", label: "Search synonyms", ar: "مرادفات البحث", icon: Search }
    ]
  },
  {
    label: "Customer experience", ar: "تجربة العملاء", links: [
      { href: "/admin/support", label: "Customer support", ar: "دعم العملاء", icon: Headphones },
      { href: "/admin/reviews", label: "Product reviews", ar: "مراجعات المنتجات", icon: MessageSquare },
      { href: "/admin/store-reviews", label: "Store reviews", ar: "مراجعات المتاجر", icon: Star },
      { href: "/admin/questions", label: "Product Q&A", ar: "أسئلة وأجوبة المنتجات", icon: HelpCircle },
      { href: "/admin/questions/reports", label: "Question reports", ar: "بلاغات الأسئلة", icon: ClipboardList },
      { href: "/admin/review", label: "Review queue", ar: "قائمة المراجعة", icon: FileText }
    ]
  },
  {
    label: "Platform controls", ar: "إعدادات المنصة", links: [
      { href: "/admin/payment-providers", label: "Payment providers", ar: "مزودو الدفع", icon: Building2, platformOnly: true },
      { href: "/admin/seller-payout-methods", label: "Seller payout verification", ar: "التحقق من حسابات البائعين", icon: Building2, platformOnly: true },
      { href: "/admin/financial-policies", label: "Financial policies", ar: "السياسات المالية", icon: Scale, platformOnly: true },
      { href: "/admin/finance/ledger", label: "General ledger", ar: "دفتر الأستاذ", icon: BookOpen, platformOnly: true },
      { href: "/admin/reports", label: "Reports", ar: "التقارير", icon: FileText, platformOnly: true },
      { href: "/admin/control-panel", label: "Super Admin", ar: "إدارة المنصة", icon: Crown, platformOnly: true },
      { href: "/admin/control-panel/access-catalog", label: "Access catalog", ar: "دليل الصلاحيات", icon: KeyRound, platformOnly: true },
      { href: "/admin/control-panel/audit-log", label: "Audit log", ar: "سجل التدقيق", icon: ClipboardList, platformOnly: true },
      { href: "/admin/control-panel/privilege-requests", label: "Privilege requests", ar: "طلبات الصلاحيات", icon: ShieldCheck, platformOnly: true },
      { href: "/admin/control-panel/ai-assistant", label: "AI assistant settings", ar: "إعدادات المساعد الذكي", icon: Bot, platformOnly: true }
    ]
  }
];

export default function AdminNavigation({ canManagePlatform = false, permissions = [] }: { canManagePlatform?: boolean; permissions?: string[] }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpenForPath, setMobileOpenForPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenForPath === pathname;
  const isArabic = locale === "ar";

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpenForPath(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return groups.map((group) => ({
      ...group,
      links: group.links.filter((link) =>
        (linkPermissions[link.href] ?? []).some((permission) => permissions.includes(permission)) &&
        (!link.platformOnly || canManagePlatform) &&
        (!normalizedQuery || [link.label, link.ar, link.href].some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery)
        ))
      )
    })).filter((group) => group.links.length > 0);
  }, [canManagePlatform, permissions, query]);

  const activeHref = groups.flatMap((group) => group.links)
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const closeMobile = () => setMobileOpenForPath(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpenForPath(mobileOpen ? null : pathname)}
        className={`fixed bottom-4 z-50 grid size-12 place-items-center rounded-full bg-[#FF8C1C] text-white shadow-lg shadow-orange-900/20 transition hover:bg-[#F0780B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 lg:hidden ${isArabic ? "left-4" : "right-4"}`}
        aria-label={translate(locale, "Toggle admin navigation", "فتح قائمة الإدارة")}
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
      >
        {mobileOpen ? <X size={20} /> : <Command size={20} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label={translate(locale, "Close navigation", "إغلاق القائمة")}
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        id="admin-sidebar"
        dir={isArabic ? "rtl" : "ltr"}
        className={`admin-sidebar fixed inset-y-0 z-40 flex h-dvh w-[min(88vw,296px)] flex-col border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none ${isArabic ? "right-0 border-l" : "left-0 border-r"} ${mobileOpen ? "translate-x-0" : isArabic ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "lg:w-[82px]" : "lg:w-[280px]"}`}
      >
        <div className="flex min-h-[76px] items-center justify-between border-b border-[var(--border)] px-4">
          <Link
            href="/admin/dashboard"
            onClick={closeMobile}
            className={`flex min-w-0 items-center gap-3 ${collapsed ? "lg:mx-auto" : ""}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#F0780B] ring-1 ring-orange-100">
              <Crown size={21} strokeWidth={2.2} />
            </span>
            <span className={collapsed ? "lg:hidden" : "min-w-0"}>
              <span className="block text-lg font-black tracking-tight text-[var(--foreground)]">
                matjar<span className="text-[#FF8C1C]">.</span>
              </span>
              <span className="block text-[10px] font-semibold tracking-wide text-[var(--muted)]">
                {translate(locale, "Platform administration", "إدارة المنصة")}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-lg p-2 text-[var(--muted)] transition hover:bg-orange-50 hover:text-[#E8750A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 lg:block"
            aria-label={translate(locale, collapsed ? "Expand sidebar" : "Collapse sidebar", collapsed ? "توسيع القائمة" : "طي القائمة")}
            aria-expanded={!collapsed}
            aria-controls="admin-navigation-links"
            title={translate(locale, collapsed ? "Expand sidebar" : "Collapse sidebar", collapsed ? "توسيع القائمة" : "طي القائمة")}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className={`border-b border-[var(--border)] px-3 py-4 ${collapsed ? "lg:hidden" : ""}`}>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-[var(--muted)] transition focus-within:border-orange-300 focus-within:bg-[var(--surface)] focus-within:ring-4 focus-within:ring-orange-50">
            <Search size={15} className="shrink-0" />
            <label className="sr-only" htmlFor="admin-navigation-search">
              {translate(locale, "Find an admin page", "ابحث عن قسم إداري")}
            </label>
            <input
              id="admin-navigation-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={translate(locale, "Find an admin page…", "ابحث عن قسم إداري…")}
              className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
                aria-label={translate(locale, "Clear search", "مسح البحث")}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <nav
          id="admin-navigation-links"
          aria-label={translate(locale, "Administration", "الإدارة")}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5"
        >
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <h2 className={`mb-2 px-3 text-[10px] font-bold tracking-wide text-[var(--muted)] ${collapsed ? "lg:hidden" : ""}`}>
                {translate(locale, group.label, group.ar)}
              </h2>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const active = activeHref === link.href;
                  const Icon = link.icon;
                  const label = translate(locale, link.label, link.ar);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobile}
                      title={collapsed ? label : undefined}
                      aria-label={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 ${collapsed ? "lg:justify-center lg:px-0" : ""} ${active ? "border-[#FFD7B0] bg-[#FFF2E5] text-[#963F08] shadow-[inset_0_0_0_1px_rgba(255,140,28,0.06)]" : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"}`}
                    >
                      {active && <span className={`absolute inset-y-2 w-[3px] rounded-full bg-[#FF8C1C] ${isArabic ? "right-0" : "left-0"}`} />}
                      <Icon size={17} strokeWidth={active ? 2.3 : 1.9} className={`shrink-0 transition-colors ${active ? "text-[#F0780B]" : "text-[var(--muted)] group-hover:text-[#E8750A]"}`} />
                      <span className={collapsed ? "lg:hidden" : "min-w-0 flex-1 truncate"}>{label}</span>
                      {active && !collapsed && <span className="size-1.5 shrink-0 rounded-full bg-[#FF8C1C]" />}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
          {!visibleGroups.length && (
            <p className="px-3 py-8 text-center text-xs text-[var(--muted)]">
              {translate(locale, "No matching admin pages", "لا توجد أقسام مطابقة")}
            </p>
          )}
        </nav>

        <div className={`border-t border-[var(--border)] p-3 ${collapsed ? "lg:px-2" : ""}`}>
          <div className={`flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 ${collapsed ? "lg:justify-center lg:p-2" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-50 text-[#D96500] ring-1 ring-orange-100">
              <Shield size={17} />
            </span>
            <span className={collapsed ? "lg:hidden" : "min-w-0"}>
              <span className="block text-xs font-bold text-[var(--foreground)]">
                {translate(locale, "Protected workspace", "مساحة عمل محمية")}
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                {translate(locale, "Role-based access · MFA", "صلاحيات حسب الدور · تحقق متعدد العوامل")}
              </span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
