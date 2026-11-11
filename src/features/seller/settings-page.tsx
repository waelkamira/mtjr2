"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
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

type SellerProfile = { displayName: string; contactName: string; contactEmail: string; phoneNumber: string; residence: string; description: string | null; facebookUrl: string | null; youtubeUrl: string | null; twitterUrl: string | null; };

export default function SellerSettingsPage() {
  const { locale } = useLocale();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/seller/profile", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { profile?: SellerProfile; error?: string };
        if (!response.ok) throw new Error(data.error || translate(locale, "Seller profile could not be loaded.", "تعذر تحميل ملف البائع."));
        if (active) setProfile(data.profile ?? null);
      })
      .catch((cause: unknown) => {
        if (active) setProfileError(cause instanceof Error ? cause.message : translate(locale, "Seller profile could not be loaded.", "تعذر تحميل ملف البائع."));
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [locale]);

  function updateProfile<K extends keyof SellerProfile>(key: K, value: SellerProfile[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setProfileSaving(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const response = await fetch("/api/seller/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          facebookUrl: profile.facebookUrl?.trim() || null,
          youtubeUrl: profile.youtubeUrl?.trim() || null,
          twitterUrl: profile.twitterUrl?.trim() || null,
          description: profile.description?.trim() || null
        })
      });
      const data = await response.json() as { profile?: SellerProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || translate(locale, "Seller profile could not be saved.", "تعذر حفظ ملف البائع."));
      setProfile(data.profile);
      setProfileMessage(translate(locale, "Seller profile saved.", "تم حفظ ملف البائع."));
      toast.success(translate(locale, "Seller profile saved.", "تم حفظ ملف البائع."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Seller profile could not be saved.", "تعذر حفظ ملف البائع.");
      setProfileError(message);
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] space-y-6 bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-[30px] border border-white/95 bg-[linear-gradient(125deg,#fff6ef_0%,#f7e9de_48%,#f2edf5_100%)] p-7 text-[#51433a] shadow-[12px_14px_28px_rgba(74,75,112,.12),inset_0_2px_0_white] sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#9a6548]">{translate(locale, "SELLER WORKSPACE", "مساحة عمل البائع")}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{translate(locale, "Store settings", "إعدادات المتجر")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#80695b]">{translate(locale, "A single place to reach the settings already connected to your store, delivery operations, notifications, team and account security.", "مكان واحد للوصول إلى الإعدادات المرتبطة فعلياً بمتجرك وعمليات التوصيل والإشعارات والفريق وأمان الحساب.")}</p>
      </header>
      <section className="rounded-[28px] border border-white/90 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-6 shadow-[8px_10px_22px_rgba(119,86,62,.07),inset_0_2px_0_white] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#9a6548]">{translate(locale, "SELLER IDENTITY", "هوية البائع")}</p><h2 className="mt-2 text-xl font-black text-[#51433a]">{translate(locale, "Business profile", "الملف التجاري")}</h2><p className="mt-1 text-sm text-[#80695b]">{translate(locale, "Keep your public seller name and business contact details up to date.", "حافظ على تحديث اسم البائع وبيانات التواصل التجارية.")}</p></div>
          <span className="rounded-full border border-white bg-white/60 px-3 py-1 text-xs font-bold text-[#80604c]">{translate(locale, "Owner-managed", "يديره مالك الحساب")}</span>
        </div>
        {profileError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{profileError}</p>}
        {profileMessage && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{profileMessage}</p>}
        {profileLoading ? <p className="mt-5 rounded-xl bg-white/55 p-5 text-sm text-[#78849a]">{translate(locale, "Loading business profile…", "جارٍ تحميل الملف التجاري…")}</p>
          : profile ? <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-[#405a6d]">{translate(locale, "Public seller name", "اسم البائع الظاهر")}<input required minLength={2} maxLength={120} value={profile.displayName} onChange={(event) => updateProfile("displayName", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#51433a]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078]">{translate(locale, "Contact person", "الشخص المسؤول")}<input required minLength={2} maxLength={120} value={profile.contactName} onChange={(event) => updateProfile("contactName", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078]">{translate(locale, "Business email", "البريد التجاري")}<input required type="email" maxLength={254} value={profile.contactEmail} onChange={(event) => updateProfile("contactEmail", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078]">{translate(locale, "Phone number", "رقم الهاتف")}<input required type="tel" minLength={7} maxLength={25} value={profile.phoneNumber} onChange={(event) => updateProfile("phoneNumber", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078] sm:col-span-2">{translate(locale, "Business address", "عنوان النشاط")}<input required minLength={3} maxLength={240} value={profile.residence} onChange={(event) => updateProfile("residence", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078] sm:col-span-2">{translate(locale, "Business description", "وصف النشاط")}<textarea rows={4} maxLength={4000} value={profile.description ?? ""} onChange={(event) => updateProfile("description", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078]">{translate(locale, "Facebook URL", "رابط فيسبوك")}<input type="url" maxLength={2048} dir="ltr" value={profile.facebookUrl ?? ""} onChange={(event) => updateProfile("facebookUrl", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-left text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078]">{translate(locale, "YouTube URL", "رابط يوتيوب")}<input type="url" maxLength={2048} dir="ltr" value={profile.youtubeUrl ?? ""} onChange={(event) => updateProfile("youtubeUrl", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-left text-sm font-normal text-[#46516b]" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#526078]">{translate(locale, "X URL", "رابط إكس")}<input type="url" maxLength={2048} dir="ltr" value={profile.twitterUrl ?? ""} onChange={(event) => updateProfile("twitterUrl", event.target.value)} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-left text-sm font-normal text-[#46516b]" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs leading-5 text-[#8790a5]">{translate(locale, "Legal identity and verification documents are not editable here. Contact the marketplace team for a legal-identity change.", "لا يمكن تعديل الهوية القانونية أو وثائق التحقق من هنا. تواصل مع فريق المنصة لتغيير البيانات القانونية.")}</p><button type="submit" disabled={profileSaving} className="rounded-xl bg-[linear-gradient(135deg,#e99a68,#d86b32)] px-5 py-3 text-sm font-extrabold text-[#ffffff] shadow-[0_7px_16px_rgba(119,86,62,.12),inset_0_1px_0_rgba(255,255,255,.65)] disabled:opacity-50">{profileSaving ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Save business profile", "حفظ الملف التجاري")}</button></div>
          </form>
          : <p className="mt-5 rounded-xl bg-white/55 p-5 text-sm text-[#78849a]">{translate(locale, "An approved seller profile is required to edit business details.", "يلزم اعتماد حساب البائع لتعديل بيانات النشاط التجاري.")}</p>}
      </section>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group rounded-[26px] border border-white/90 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-5 shadow-[8px_10px_22px_rgba(119,86,62,.07),inset_0_2px_0_white,inset_0_-3px_7px_rgba(119,86,62,.035)] transition duration-200 hover:-translate-y-1 hover:shadow-[10px_14px_26px_rgba(119,86,62,.10),inset_0_2px_0_white]">
            <div className={`grid size-14 place-items-center rounded-[19px] bg-gradient-to-br ${section.tone} text-2xl shadow-[0_6px_14px_rgba(74,75,112,.09),inset_0_2px_0_rgba(255,255,255,.8)]`} aria-hidden="true">{section.icon}</div>
            <h2 className="mt-5 text-lg font-black text-[#51433a]">{translate(locale, section.title, section.ar)}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-[#78849a]">{translate(locale, section.description, section.descriptionAr)}</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/60 px-4 py-2 text-xs font-extrabold text-[#526078] shadow-[inset_0_1px_0_white]">{translate(locale, "Open settings", "فتح الإعدادات")} <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </section>
    </main>
  );
}
