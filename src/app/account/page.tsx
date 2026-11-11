"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

const sectionStyles = [
  { tone: "from-violet-100 to-purple-50", icon: "user", accent: "text-violet-700", glow: "group-hover:shadow-violet-200/70" },
  { tone: "from-sky-100 to-cyan-50", icon: "package", accent: "text-sky-700", glow: "group-hover:shadow-sky-200/70" },
  { tone: "from-rose-100 to-pink-50", icon: "heart", accent: "text-rose-700", glow: "group-hover:shadow-rose-200/70" },
  { tone: "from-amber-100 to-yellow-50", icon: "map", accent: "text-amber-700", glow: "group-hover:shadow-amber-200/70" },
  { tone: "from-orange-100 to-amber-50", icon: "return", accent: "text-orange-700", glow: "group-hover:shadow-orange-200/70" },
  { tone: "from-fuchsia-100 to-pink-50", icon: "star", accent: "text-fuchsia-700", glow: "group-hover:shadow-fuchsia-200/70" },
  { tone: "from-indigo-100 to-blue-50", icon: "question", accent: "text-indigo-700", glow: "group-hover:shadow-indigo-200/70" },
  { tone: "from-cyan-100 to-teal-50", icon: "message", accent: "text-cyan-700", glow: "group-hover:shadow-cyan-200/70" },
  { tone: "from-emerald-100 to-green-50", icon: "support", accent: "text-emerald-700", glow: "group-hover:shadow-emerald-200/70" },
  { tone: "from-yellow-100 to-lime-50", icon: "bell", accent: "text-yellow-700", glow: "group-hover:shadow-yellow-200/70" },
  { tone: "from-orange-100 to-rose-50", icon: "store", accent: "text-orange-700", glow: "group-hover:shadow-orange-200/70" }
];

function SectionIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
    package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 12v9" /></>,
    heart: <path d="M20.8 8.8c0 4.2-8.8 10-8.8 10s-8.8-5.8-8.8-10A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.4Z" />,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
    return: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    question: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.8c-1.1 1-1.9 1.3-1.9 3m0 3h.01" /></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-4-.9L4 20l1.2-3.5A7.2 7.2 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7Z" /></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><path d="M4 13h3v6H6a2 2 0 0 1-2-2v-4Zm16 0h-3v6h1a2 2 0 0 0 2-2v-4ZM17 20a5 5 0 0 1-5 2" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    store: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>
  };
  return <svg viewBox="0 0 24 24" className="size-6" {...common} aria-hidden="true">{paths[name] ?? paths.user}</svg>;
}

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] px-4 py-7 text-[var(--color-ink-950)] sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange-300/20 blur-3xl" />
        <div className="absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-violet-300/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(rgba(120,100,80,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(120,100,80,.35) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-black tracking-tight text-[var(--color-ink-950)]">mtjr<span className="text-[#FF8C1C]">.</span></Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--color-ink-700)] shadow-sm transition hover:border-[#FF8C1C]/50 hover:text-[#D96B00] hover:shadow-md">
            {t("Continue shopping", "متابعة التسوق")} <span aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
          </Link>
        </header>

        <section className="relative mt-9 overflow-hidden rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-[0_18px_55px_rgba(75,55,35,.08),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-xl sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-gradient-to-br from-orange-200/60 to-rose-100/20 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-violet-100/50 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#C9670B]">
                <span className="size-1.5 rounded-full bg-[#FF8C1C]" />
                {t("YOUR MATJAR SPACE", "مساحتك في متجر")}
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--color-ink-950)] sm:text-4xl">{t("My account", "حسابي")}</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">{t("Your purchases, saved items, profile and seller tools in one place.", "مشترياتك والعناصر المحفوظة وملفك الشخصي وأدوات البائع في مكان واحد.")}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white px-4 py-3 shadow-[0_8px_22px_rgba(234,128,43,.08)]">
              <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#FFB15C] to-[#FF8C1C] text-white shadow-[0_5px_14px_rgba(255,140,28,.28)]">
                <SectionIcon name="user" />
              </span>
              <div>
                <p className="text-xs font-bold text-[var(--color-ink-900)]">{t("Your account", "حسابك")}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t("Everything in its place", "كل شيء في مكانه")}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-4 mt-9 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#D97716]">{t("ACCOUNT CENTER", "مركز الحساب")}</p>
            <h2 className="mt-1.5 text-xl font-extrabold text-[var(--color-ink-950)]">{t("Manage your space", "إدارة مساحتك")}</h2>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-white/75 px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">{sections.length} {t("sections", "أقسام")}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, index) => {
            const style = sectionStyles[index];
            return (
              <Link key={section.href} href={section.href} className={`group relative overflow-hidden rounded-[1.55rem] border border-white/90 bg-white/80 p-5 shadow-[0_9px_28px_rgba(55,45,35,.055),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_16px_34px_rgba(75,55,35,.10)] ${style.glow}`}>
                <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-gradient-to-br from-orange-100/30 to-violet-100/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex items-start gap-4">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${style.tone} ${style.accent} shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_5px_12px_rgba(60,50,40,.07)] ring-1 ring-white/80 transition duration-300 group-hover:scale-105`}>
                    <SectionIcon name={style.icon} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="font-extrabold text-[var(--color-ink-950)] transition-colors group-hover:text-[#D96B00]">{section.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{section.description}</p>
                  </div>
                </div>
                <div className="relative mt-5 flex items-center justify-between border-t border-[var(--border)]/70 pt-3.5">
                  <span className="text-xs font-bold text-[#D97716]">{t("Open section", "فتح القسم")}</span>
                  <span className="grid size-8 place-items-center rounded-full bg-orange-50 text-[#D97716] transition duration-300 group-hover:bg-[#FF8C1C] group-hover:text-white group-hover:shadow-[0_4px_12px_rgba(255,140,28,.25)]" aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
