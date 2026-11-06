"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export default function AccountHomePage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const sections = [
    { title: t("Personal profile", "الملف الشخصي"), description: t("Your name and account details", "اسمك وتفاصيل حسابك"), href: "/account/profile" },
    { title: t("My orders", "طلباتي"), description: t("Track purchases and order history", "تتبّع مشترياتك وسجل الطلبات"), href: "/account/orders" },
    { title: t("Favorites", "المفضلة"), description: t("Products you have saved", "المنتجات التي حفظتها"), href: "/account/wishlist" },
    { title: t("Saved addresses", "العناوين المحفوظة"), description: t("Delivery addresses for checkout", "عناوين التوصيل لإتمام الشراء"), href: "/account/addresses" },
    { title: t("Returns", "المرتجعات"), description: t("Manage return requests", "إدارة طلبات الإرجاع"), href: "/account/returns" },
    { title: t("Reviews", "التقييمات"), description: t("Your product and store reviews", "تقييماتك للمنتجات والمتاجر"), href: "/account/reviews" },
    { title: t("Questions", "الأسئلة"), description: t("Your product questions and answers", "أسئلتك وإجاباتها حول المنتجات"), href: "/account/questions" },
    { title: t("Messages", "الرسائل"), description: t("Conversations with stores", "محادثاتك مع المتاجر"), href: "/account/messages" },
    { title: t("Support", "الدعم"), description: t("Help requests and support tickets", "طلبات المساعدة وتذاكر الدعم"), href: "/account/support" },
    { title: t("Notifications", "الإشعارات"), description: t("Updates about your account and orders", "تحديثات حول حسابك وطلباتك"), href: "/notifications" },
    { title: t("Seller workspace", "مساحة عمل البائع"), description: t("Apply to sell or manage your store", "قدّم للبيع أو أدر متجرك"), href: "/seller" }
  ];
  return <main className="min-h-screen bg-[var(--background)] px-5 py-10"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between"><Link href="/" className="text-2xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/" className="text-sm text-[var(--color-ink-600)]">{t("Continue shopping", "متابعة التسوق")}</Link></header><p className="mt-10 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">{t("Your marketplace", "مساحتك في السوق")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("My account", "حسابي")}</h1><p className="mt-2 text-sm text-[var(--muted)]">{t("Your purchases, saved items, profile and seller tools in one place.", "مشترياتك والعناصر المحفوظة وملفك الشخصي وأدوات البائع في مكان واحد.")}</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map(section=><Link key={section.href} href={section.href} className="clay-surface rounded-[var(--radius-card)] border border-[var(--border)] p-5 transition hover:-translate-y-0.5 hover:shadow-clay-raised-hover"><h2 className="font-semibold text-[var(--color-ink-950)]">{section.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{section.description}</p><span className="mt-4 inline-block text-sm font-semibold text-[var(--color-lavender-600)]">{t("Open →", "فتح ←")}</span></Link>)}</div></div></main>;
}
