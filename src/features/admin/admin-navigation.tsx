"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const links = [
  { href: "/admin/dashboard", label: "Overview", ar: "نظرة عامة" },
  { href: "/admin/users", label: "Users", ar: "المستخدمون" },
  { href: "/admin/sellers", label: "Sellers & stores", ar: "البائعون والمتاجر" },
  { href: "/admin/products", label: "Product approvals", ar: "اعتماد المنتجات" },
  { href: "/admin/product-management", label: "Product management", ar: "إدارة المنتجات" },
  { href: "/admin/categories", label: "Categories", ar: "الفئات" },
  { href: "/admin/orders", label: "Orders", ar: "الطلبات" },
  { href: "/admin/payments", label: "Payments", ar: "المدفوعات" },
  { href: "/admin/logistics", label: "Shipments", ar: "الشحنات" },
  { href: "/admin/returns", label: "Returns", ar: "المرتجعات" },
  { href: "/admin/support", label: "Customer support", ar: "دعم العملاء" },
  { href: "/admin/reviews", label: "Product reviews", ar: "مراجعات المنتجات" },
  { href: "/admin/store-reviews", label: "Store reviews", ar: "مراجعات المتاجر" },
  { href: "/admin/questions", label: "Product Q&A", ar: "أسئلة وأجوبة المنتجات" },
  { href: "/admin/search-synonyms", label: "Search synonyms", ar: "مرادفات البحث" },
  { href: "/admin/tax-rates", label: "Tax rates", ar: "معدلات الضرائب" },
  { href: "/admin/commissions", label: "Commissions", ar: "العمولات" },
  { href: "/admin/advertising", label: "Advertising review", ar: "مراجعة الإعلانات" },
  { href: "/admin/coupons", label: "Discount codes", ar: "رموز الخصم" },
  { href: "/admin/control-panel", label: "Super Admin", ar: "إدارة المنصة", platformOnly: true }
];

export default function AdminNavigation({ canManagePlatform = false }: { canManagePlatform?: boolean }) {
  const pathname = usePathname();
  const { locale } = useLocale();

  return (
    <aside className="border-b border-[var(--border)] bg-[var(--color-forest-950)] text-white lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block">
        <Link href="/admin/dashboard" className="text-xl font-semibold">
          MATJAR<span className="text-[var(--color-copper-600)]">.</span>
        </Link>
        <span className="text-xs text-white/60">{translate(locale, "Administration", "الإدارة")}</span>
      </div>
      <nav aria-label={translate(locale, "Administration", "الإدارة")} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3">
        {links.filter((link) => !("platformOnly" in link) || !link.platformOnly || canManagePlatform).map((link) => {
          const active = link.href === "/admin/dashboard"
            ? pathname === link.href || pathname === "/admin/control-panel"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors lg:block ${
                active ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              {translate(locale, link.label, link.ar)}
            </Link>
          );
        })}
      </nav>
      <div className="hidden px-6 pt-5 text-xs leading-5 text-white/50 lg:block">
        {translate(locale, "Navigation includes implemented admin areas only. Additional modules will appear as their workflows are built.", "تتضمن قائمة التنقل أقسام الإدارة المتاحة فقط. ستظهر الوحدات الإضافية عند اكتمال إجراءات العمل الخاصة بها.")}
      </div>
    </aside>
  );
}
