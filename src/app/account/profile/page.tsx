"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

type Profile = { id: string; email: string; displayName: string | null; status: string; createdAt: string };
type Analytics = {
  totalOrders: number;
  orderStatuses: Array<{ status: string; count: number }>;
  monthlyOrders: Array<{ month: string; count: number }>;
  favorites: number;
  productReviews: number;
  storeReviews: number;
};

export default function ProfilePage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { profile?: Profile; analytics?: Analytics; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error || "Unable to load profile.");
        if (active) {
          setProfile(data.profile);
          setAnalytics(data.analytics ?? null);
          setName(data.profile.displayName || "");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("Unable to load profile.", "تعذّر تحميل الملف الشخصي."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name })
      });
      const data = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || t("Unable to update profile.", "تعذّر تحديث الملف الشخصي."));
      setProfile((current) => current ? { ...current, ...data.profile } : current);
      setNotice(t("Profile updated.", "تم تحديث الملف الشخصي."));
      toast.success(t("Profile updated.", "تم تحديث الملف الشخصي."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Unable to update profile.", "تعذّر تحديث الملف الشخصي.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const orderColors = ["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-cyan-500"];
  const monthLabels = (analytics?.monthlyOrders ?? []).map((row) => ({
    label: new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(new Date(row.month + "-01T00:00:00Z")),
    value: row.count,
    color: "bg-gradient-to-r from-indigo-500 to-violet-500"
  }));

  return (
    <main className="account-profile-studio relative min-h-screen overflow-hidden px-4 py-7 text-black sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/[0.06] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <Link href="/account" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-black/70 transition hover:border-amber-400/30 hover:bg-amber-500/[0.06] hover:text-black">← {t("My account", "حسابي")}</Link>
        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-black">{t("MATJAR / PERSONAL SPACE", "متجر / المساحة الشخصية")}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-black sm:text-4xl">{t("Personal profile", "الملف الشخصي")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">{t("Manage the details associated with your marketplace account.", "أدر التفاصيل المرتبطة بحسابك في السوق.")}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,.2)]">
            <p className="text-[9px] font-bold uppercase tracking-[.2em] text-black/35">{t("Account status", "حالة الحساب")}</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-black"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]" />{profile?.status ?? t("Loading", "جارٍ التحميل")}</p>
          </div>
        </div>
        {loading ? <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-black/55">{t("Loading profile…", "جارٍ تحميل الملف الشخصي…")}</p> : profile ? <>
          <section className="mt-7 overflow-hidden rounded-[1.75rem] border border-white/10 p-5 shadow-[0_18px_48px_rgba(0,0,0,.3),inset_0_1px_0_rgba(255,255,255,.04)] sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-amber-400/25 to-orange-500/10 text-amber-300 ring-1 ring-amber-400/20">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>
              </span>
              <div><h2 className="text-base font-bold text-black">{t("Account details", "بيانات الحساب")}</h2><p className="mt-1 text-xs text-black/40">{t("Your personal information and contact address.", "معلوماتك الشخصية وبيانات التواصل.")}</p></div>
            </div>
            {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
            {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
            <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-black/75">{t("Display name", "الاسم المعروض")}
                <input className="mt-2 w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-black shadow-inner outline-none transition placeholder:text-black/30 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10" value={name} onChange={(event) => setName(event.target.value)} required minLength={1} maxLength={80} />
              </label>
              <label className="block text-sm font-semibold text-black/75">{t("Email address", "البريد الإلكتروني")}
                <input className="mt-2 w-full rounded-xl border border-white/[0.07] px-4 py-3 text-sm text-black/55 shadow-inner outline-none" value={profile.email} readOnly />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                <span className="text-xs text-black/40">{t("Account status:", "حالة الحساب:")} <StatusBadge locale={locale} status={profile.status} /></span>
                <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-[#17120c] shadow-[0_7px_20px_rgba(251,146,60,.22)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? t("Saving…", "جارٍ الحفظ…") : t("Save changes", "حفظ التغييرات")}
                </button>
              </div>
            </form>
            <div className="mt-7 border-t border-white/10 pt-5">
              <Link href="/account/addresses" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 transition hover:text-amber-200">{t("Manage saved addresses →", "إدارة العناوين المحفوظة ←")}</Link>
            </div>
          </section>

          {analytics && <section aria-label="Personal account analytics" className="mt-8">
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-black">{t("YOUR ACTIVITY", "نشاطك")}</p>
              <h2 className="mt-2 text-xl font-bold text-black">{t("Your marketplace activity", "نشاطك في السوق")}</h2>
              <p className="mt-1 text-sm text-black/45">{t("Private statistics for your signed-in account only.", "إحصاءات خاصة بحسابك المسجل فقط.")}</p>
            </div>
            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [t("Total orders", "إجمالي الطلبات"), analytics.totalOrders],
                [t("Saved favorites", "المنتجات المفضلة"), analytics.favorites],
                [t("Product reviews", "مراجعات المنتجات"), analytics.productReviews],
                [t("Store reviews", "مراجعات المتاجر"), analytics.storeReviews]
              ].map(([label, value], index) => {
                const tones = [
                  "from-violet-500/15 to-purple-600/[0.04] text-violet-200 ring-violet-400/15",
                  "from-rose-500/15 to-pink-600/[0.04] text-rose-200 ring-rose-400/15",
                  "from-sky-500/15 to-blue-600/[0.04] text-sky-200 ring-sky-400/15",
                  "from-emerald-500/15 to-teal-600/[0.04] text-emerald-200 ring-emerald-400/15"
                ];
                return <div key={String(label)} className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br ${tones[index]} p-5 shadow-[0_10px_28px_rgba(0,0,0,.2)] ring-1 ring-inset`}><p className="text-xs text-black/50">{label}</p><p className="mt-2 text-3xl font-black tabular-nums text-black">{value}</p></div>;
              })}
            </div>
            <div className=" grid gap-4 md:grid-cols-2">
              <MetricBarChart variant="donut" title="Orders by status" rows={analytics.orderStatuses.map((row, index) => ({
                label: translateStatus(locale, row.status),
                value: row.count,
                color: orderColors[index % orderColors.length]
              }))} />
              <MetricBarChart variant="area" title="Orders by month" rows={monthLabels.length ? monthLabels : [{ label: "No orders yet", value: 0, color: "bg-slate-400" }]} />
              <MetricBarChart variant="bar" title="Customer engagement" rows={[
                { label: "Saved favorites", value: analytics.favorites, color: "bg-pink-500" },
                { label: "Product reviews", value: analytics.productReviews, color: "bg-violet-500" },
                { label: "Store reviews", value: analytics.storeReviews, color: "bg-cyan-500" }
              ]} />
            </div>
          </section>}
        </> : <p role="alert" className="mt-8 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-200">{error || t("Profile unavailable.", "الملف الشخصي غير متاح.")}</p>}
      </div>
      <style jsx global>{`
        .account-profile-studio .account-profile-charts article {
          border-color: rgba(255,255,255,.09) !important;
          background: linear-gradient(145deg,#191b25,#13151d) !important;
          box-shadow: 0 12px 30px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.035) !important;
        }
        .account-profile-studio .account-profile-charts article h3 { color: #f4f2ee !important; }
        .account-profile-studio .account-profile-charts article :is(p,strong,span) { color: #b8b8c4; }
        .account-profile-studio .account-profile-charts article :is(.text-slate-800,.text-slate-700,.text-\\[\\#405a6d\\],.text-\\[\\#344d60\\]) { color: #f4f2ee !important; }
        .account-profile-studio .account-profile-charts article :is(.text-slate-500,.text-slate-400,.text-\\[\\#688394\\],.text-\\[\\#829aa7\\]) { color: #a6a6b2 !important; }
        .account-profile-studio .account-profile-charts article :is(.bg-slate-100) { background: rgba(255,255,255,.09) !important; }
      `}</style>
    </main>
  );
}
