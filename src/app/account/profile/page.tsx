"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(255,140,28,.07),transparent_34%),radial-gradient(ellipse_at_top_right,rgba(255,140,28,.035),transparent_34%),#fafafa] px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/account" className="text-sm text-[var(--color-ink-600)]">← {t("My account", "حسابي")}</Link>
        <h1 className="mt-5 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Personal profile", "الملف الشخصي")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("Manage the details associated with your marketplace account.", "أدر التفاصيل المرتبطة بحسابك في السوق.")}</p>
        {loading ? <p className="mt-8">{t("Loading profile…", "جارٍ تحميل الملف الشخصي…")}</p> : profile ? <>
          <section className="mt-7 rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_12px_34px_rgba(15,23,42,.05)] sm:p-8">
            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mb-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
            <form onSubmit={save} className="space-y-5">
              <label className="block text-sm font-medium">{t("Display name", "الاسم المعروض")}
                <input className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" value={name} onChange={(event) => setName(event.target.value)} required minLength={1} maxLength={80} />
              </label>
              <label className="block text-sm font-medium">{t("Email address", "البريد الإلكتروني")}
                <input className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3" value={profile.email} readOnly />
              </label>
              <div className="text-xs text-[var(--muted)]">{t("Account status:", "حالة الحساب:")} {profile.status}</div>
              <button disabled={busy} className="rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? t("Saving…", "جارٍ الحفظ…") : t("Save changes", "حفظ التغييرات")}
              </button>
            </form>
            <div className="mt-8 border-t border-[var(--border)] pt-5">
              <Link href="/account/addresses" className="font-semibold text-[var(--color-ink-600)]">{t("Manage saved addresses →", "إدارة العناوين المحفوظة ←")}</Link>
            </div>
          </section>

          {analytics && <section aria-label="Personal account analytics" className="mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-ink-950)]">{t("Your marketplace activity", "نشاطك في السوق")}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("Private statistics for your signed-in account only.", "إحصاءات خاصة بحسابك المسجل فقط.")}</p>
            </div>
            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [t("Total orders", "إجمالي الطلبات"), analytics.totalOrders],
                [t("Saved favorites", "المنتجات المفضلة"), analytics.favorites],
                [t("Product reviews", "مراجعات المنتجات"), analytics.productReviews],
                [t("Store reviews", "مراجعات المتاجر"), analytics.storeReviews]
              ].map(([label, value]) => <div key={String(label)} className="rounded-3xl border border-white/80 bg-gradient-to-br from-white to-violet-50/70 p-5 shadow-[0_8px_24px_rgba(15,23,42,.045)]"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>)}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <MetricBarChart variant="donut" title="Orders by status" rows={analytics.orderStatuses.map((row, index) => ({
                label: row.status.replaceAll("_", " ").toLowerCase(),
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
        </> : <p role="alert" className="mt-8">{error || t("Profile unavailable.", "الملف الشخصي غير متاح.")}</p>}
      </div>
    </main>
  );
}
