
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Store,
  ShieldCheck,
  Package,
  Tags,
  Award,
  ShoppingCart,
  CreditCard,
  Building2,
  Truck,
  RotateCcw,
  Banknote,
  Headphones,
  MessageSquare,
  Star,
  HelpCircle,
  Search,
  Percent,
  Coins,
  Ticket,
  Megaphone,
  Shield,
  Crown,
} from "lucide-react";

const links = [
  { href: "/admin/dashboard", label: "Overview", ar: "نظرة عامة", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", ar: "المستخدمون", icon: Users },
  { href: "/admin/sellers", label: "Sellers & stores", ar: "البائعون والمتاجر", icon: Store },
  { href: "/admin/products", label: "Product approvals", ar: "اعتماد المنتجات", icon: ShieldCheck },
  { href: "/admin/product-management", label: "Product management", ar: "إدارة المنتجات", icon: Package },
  { href: "/admin/categories", label: "Categories", ar: "الفئات", icon: Tags },
  { href: "/admin/brands", label: "Brands", ar: "العلامات التجارية", icon: Award },
  { href: "/admin/orders", label: "Orders", ar: "الطلبات", icon: ShoppingCart },
  { href: "/admin/payments", label: "Payments", ar: "المدفوعات", icon: CreditCard },
  { href: "/admin/payment-providers", label: "Payment providers", ar: "مزودو الدفع", icon: Building2, platformOnly: true },
  { href: "/admin/seller-payout-methods", label: "Seller payout verification", ar: "التحقق من حسابات البائعين", icon: Building2, platformOnly: true },
  { href: "/admin/logistics", label: "Shipments", ar: "الشحنات", icon: Truck },
  { href: "/admin/returns", label: "Returns", ar: "المرتجعات", icon: RotateCcw },
  { href: "/admin/refunds", label: "Refunds", ar: "استرداد المدفوعات", icon: Banknote },
  { href: "/admin/support", label: "Customer support", ar: "دعم العملاء", icon: Headphones },
  { href: "/admin/reviews", label: "Product reviews", ar: "مراجعات المنتجات", icon: MessageSquare },
  { href: "/admin/store-reviews", label: "Store reviews", ar: "مراجعات المتاجر", icon: Star },
  { href: "/admin/questions", label: "Product Q&A", ar: "أسئلة وأجوبة المنتجات", icon: HelpCircle },
  { href: "/admin/search-synonyms", label: "Search synonyms", ar: "مرادفات البحث", icon: Search },
  { href: "/admin/tax-rates", label: "Tax rates", ar: "معدلات الضرائب", icon: Percent },
  { href: "/admin/commissions", label: "Commissions", ar: "العمولات", icon: Coins },
  { href: "/admin/coupons", label: "Discount codes", ar: "رموز الخصم", icon: Ticket },
  { href: "/admin/advertising", label: "Advertising review", ar: "مراجعة الإعلانات", icon: Megaphone },
  { href: "/admin/control-panel", label: "Super Admin", ar: "إدارة المنصة", icon: Crown, platformOnly: true },
];

export default function AdminNavigation({ canManagePlatform = false }: { canManagePlatform?: boolean }) {
  const pathname = usePathname();
  const { locale } = useLocale();

  const filteredLinks = links.filter(
    (link) => !("platformOnly" in link) || !link.platformOnly || canManagePlatform
  );

  return (
    <aside className="relative min-h-screen w-full h-fit overflow-hidden bg-gray-600 backdrop-blur-md shadow-xl lg:w-80 lg:shrink-0 border-2 border-orange-400" dir="rtl">
      {/* ================= Soft Background Elements ================= */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none lg:absolute">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-200/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-amber-100/30 rounded-full blur-[90px]" />
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-orange-100/20 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2" />
      </div>

   

      <div className="relative z-10 flex h-full flex-col">
        
        {/* ================= Header Section ================= */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 py-8 border-b border-stone-200/60"
        >
          <Link href="/admin/dashboard" className="flex items-center gap-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 group-hover:shadow-orange-500/30 text-white transition-all duration-300">
              <Crown className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl text-white tracking-tight">
                MATJAR<span className="text-white">.</span>
              </h1>
              <p className="text-xs text-white font-medium tracking-wider uppercase">
                {translate(locale, "Administration", "لوحة الإدارة")}
              </p>
            </div>
          </Link>
        </motion.div>

        {/* ================= Navigation Menu ================= */}
        <nav 
          aria-label={translate(locale, "Administration", "الإدارة")} 
          className="flex-1 overflow-y-auto px-4 py-6 space-y-1"
        >
          {filteredLinks.map((link, index) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            
            return (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-400 shadow-md shadow-orange-500/10"
                      : "bg-white/60 border  border-stone-200/60 hover:bg-white hover:border-orange-400 hover:shadow-sm"
                  }`}
                >
                  {/* مؤشر النشاط */}
                  {isActive && (
                    <span className="absolute right-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-l-full bg-gradient-to-b from-orange-500 to-amber-500 shadow-sm" />
                  )}
                  
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                      : "bg-stone-100 text-stone-500 group-hover:bg-orange-100 group-hover:text-orange-600"
                  }`}>
                    <Icon size={20} />
                  </div>
                  
                  <span className={`flex-1 text-sm font-semibold transition-colors duration-300 ${
                    isActive
                      ? "text-stone-900"
                      : "text-stone-600 group-hover:text-stone-900"
                  }`}>
                    {translate(locale, link.label, link.ar)}
                  </span>

                  {/* سهم صغير للروابط النشطة */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-orange-500"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* ================= Footer Section ================= */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-6 py-5 border-t border-stone-200/60 bg-white/60 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/60 flex items-center justify-center">
              <Shield className="text-orange-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-900 truncate">لوحة تحكم آمنة</p>
              <p className="text-[10px] text-stone-600 truncate">صلاحيات محدودة</p>
            </div>
          </div>
          <p className="text-[10px] leading-4 text-stone-600">
            {translate(
              locale,
              "Navigation includes implemented admin areas only. Additional modules will appear as their workflows are built.",
              "تتضمن القائمة أقسام الإدارة المتاحة حالياً. ستظهر الوحدات الإضافية تلقائياً عند اكتمال تطويرها."
            )}
          </p>
        </motion.div>
      </div>
    </aside>
  );
}