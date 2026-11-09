"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const sections = [
  {
    href: "/seller#store-management",
    title: "Store profile & dispatch",
    ar: "ملف المتجر وبيانات الشحن",
    description: "Update your public store name, dispatch address and shipping contact details.",
    descriptionAr: "حدّث اسم متجرك العام وعنوان تجهيز الطلبات وبيانات مسؤول الشحن.",
    icon: "🏬",
    tone: "from-[#e9e4fb] to-[#d7cff2]"
  },
  {
    href: "/seller/shipping",
    title: "Delivery services",
    ar: "خدمات التوصيل",
    description: "Manage delivery prices, supported markets, currencies and delivery windows.",
    descriptionAr: "أدر أسعار التوصيل والأسواق والعملات المتاحة ومدد التسليم.",
    icon: "🚚",
    tone: "from-[#dff2ed] to-[#c8e7dc]"
  },
  {
    href: "/notifications",
    title: "Notifications",
    ar: "الإشعارات",
    description: "Choose in-app and email channels and review your account notifications.",
    descriptionAr: "اختر قنوات الإشعارات داخل التطبيق والبريد وراجع إشعارات حسابك.",
    icon: "🔔",
    tone: "from-[#f9e6df] to-[#f0d4c9]"
  },
  {
    href: "/account/security",
    title: "Account security",
    ar: "أمان الحساب",
    description: "Manage your password, multi-factor authentication and active sessions.",
    descriptionAr: "أدر كلمة المرور والمصادقة متعددة العوامل والجلسات النشطة.",
    icon: "🔐",
    tone: "from-[#e0edf8] to-[#cbddec]"
  },
  {
    href: "/seller/staff",
    title: "Team & permissions",
    ar: "الفريق والصلاحيات",
    description: "Manage store staff invitations and access within your permitted scope.",
    descriptionAr: "أدر دعوات فريق المتجر وصلاحيات الوصول ضمن النطاق المسموح.",
    icon: "👥",
    tone: "from-[#f5edcf] to-[#ebdfb8]"
  }
];

export default function SellerSettingsPage() {
  const { locale } = useLocale();
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] space-y-6 bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(135deg,#304b63_0%,#203449_100%)] p-7 text-white shadow-[0_16px_34px_rgba(25,44,63,.2),inset_0_1px_0_rgba(255,255,255,.18)] sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#b8d8df]">{translate(locale, "SELLER WORKSPACE", "مساحة عمل البائع")}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{translate(locale, "Store settings", "إعدادات المتجر")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/85">{translate(locale, "A single place to reach the settings already connected to your store, delivery operations, notifications, team and account security.", "مكان واحد للوصول إلى الإعدادات المرتبطة فعلياً بمتجرك وعمليات التوصيل والإشعارات والفريق وأمان الحساب.")}</p>
      </header>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group rounded-[26px] border border-white/90 bg-[linear-gradient(145deg,#edf3f5,#d5e1e7)] p-5 shadow-[8px_10px_22px_rgba(38,66,84,.1),inset_0_2px_0_white,inset_0_-3px_7px_rgba(57,86,105,.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[10px_14px_26px_rgba(38,66,84,.15),inset_0_2px_0_white]">
            <div className={`grid size-14 place-items-center rounded-[19px] bg-gradient-to-br ${section.tone} text-2xl shadow-[0_6px_14px_rgba(40,65,84,.1),inset_0_2px_0_rgba(255,255,255,.8)]`} aria-hidden="true">{section.icon}</div>
            <h2 className="mt-5 text-lg font-black text-[#2d4a60]">{translate(locale, section.title, section.ar)}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[#647d8d]">{translate(locale, section.description, section.descriptionAr)}</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/60 px-4 py-2 text-xs font-extrabold text-[#35566b] shadow-[inset_0_1px_0_white]">{translate(locale, "Open settings", "فتح الإعدادات")} <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </section>
    </main>
  );
}
