"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import {
  type ChartDatum,
  ColumnChart,
  HistogramChart,
  HorizontalBarChart,
  LineAreaChart,
  PieChart
} from "@/components/data-charts";

type Profile = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  createdAt: string;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  vendorOrders: Array<{
    store: { name: string };
    items: Array<{ quantity: number }>;
  }>;
};

export default function ProfilePage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [orderAnalyticsLoading, setOrderAnalyticsLoading] = useState(true);
  const [orderAnalyticsError, setOrderAnalyticsError] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { profile?: Profile; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error || t("Unable to load profile.", "تعذّر تحميل الملف الشخصي."));
        if (active) {
          setProfile(data.profile);
          setName(data.profile.displayName || "");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("Unable to load profile.", "تعذّر تحميل الملف الشخصي."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale, t]);

  useEffect(() => {
    let active = true;
    fetch("/api/orders", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { orders?: CustomerOrder[] };
        if (!response.ok) throw new Error("Order history is unavailable.");
        if (active) setOrders(data.orders ?? []);
      })
      .catch(() => {
        if (active) {
          setOrders([]);
          setOrderAnalyticsError(true);
        }
      })
      .finally(() => { if (active) setOrderAnalyticsLoading(false); });
    return () => { active = false; };
  }, []);

  const monthlyOrders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      const month = order.placedAt.slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .slice(-12)
      .map(([month, value]) => ({ label: month, value }));
  }, [orders]);

  const statusChart = useMemo<ChartDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    const statusLabels: Record<string, string> = {
      PENDING_PAYMENT: t("Awaiting payment", "بانتظار الدفع"),
      CONFIRMED: t("Confirmed", "مؤكد"),
      PROCESSING: t("Processing", "قيد المعالجة"),
      PARTIALLY_FULFILLED: t("Partially fulfilled", "منفذ جزئيًا"),
      FULFILLED: t("Fulfilled", "منفذ"),
      COMPLETED: t("Completed", "مكتمل"),
      CANCELLED: t("Cancelled", "ملغى")
    };
    return [...counts.entries()].map(([status, value]) => ({
      label: statusLabels[status] ?? status,
      value
    }));
  }, [orders, t]);

  const storeOrders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      for (const vendorOrder of order.vendorOrders) {
        counts.set(vendorOrder.store.name, (counts.get(vendorOrder.store.name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 6);
  }, [orders]);

  const itemCounts = orders.map((order) =>
    order.vendorOrders.reduce(
      (total, vendorOrder) => total + vendorOrder.items.reduce((sum, item) => sum + item.quantity, 0),
      0
    )
  );

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
      const data = await response.json() as { profile?: Partial<Profile>; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || t("Unable to update profile.", "تعذّر تحديث الملف الشخصي."));
      setProfile((current) => current ? { ...current, ...data.profile } : current);
      setNotice(t("Profile updated.", "تم تحديث الملف الشخصي."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to update profile.", "تعذّر تحديث الملف الشخصي."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/account" className="text-sm text-[var(--color-ink-600)]">← {t("My account", "حسابي")}</Link>
        <h1 className="mt-5 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Personal profile", "الملف الشخصي")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("Manage the details associated with your marketplace account.", "أدر التفاصيل المرتبطة بحسابك في السوق.")}</p>

        {profile && (
          <section aria-label={t("Account activity", "نشاط الحساب")} className="mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-ink-950)]">{t("Your account activity", "نشاط حسابك")}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("Charts summarize your order history. Order totals in different currencies are kept separate.", "تلخص المخططات سجل طلباتك. تبقى إجماليات الطلبات بعملات مختلفة منفصلة.")}</p>
            </div>
            {orderAnalyticsLoading ? (
              <p role="status" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
                {t("Loading your order analytics…", "جارٍ تحميل تحليلات طلباتك…")}
              </p>
            ) : orderAnalyticsError ? (
              <p role="status" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
                {t("Your order analytics are temporarily unavailable.", "تحليلات طلباتك غير متاحة مؤقتًا.")}
              </p>
            ) : orders.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <LineAreaChart
                  title={t("Orders over time", "الطلبات بمرور الوقت")}
                  description={t("Monthly activity from your latest 50 orders, shown for up to 12 months.", "النشاط الشهري ضمن أحدث ٥٠ طلبًا، مع عرض يصل إلى ١٢ شهرًا.")}
                  data={monthlyOrders}
                  emptyLabel={t("No monthly orders to chart.", "لا توجد طلبات شهرية لعرضها.")}
                />
                <PieChart
                  title={t("Order status mix", "توزيع حالات الطلبات")}
                  description={t("Each segment shows its share of your order history.", "يمثل كل جزء حصته من سجل طلباتك.")}
                  data={statusChart}
                  emptyLabel={t("No order statuses to chart.", "لا توجد حالات طلبات لعرضها.")}
                />
                <HistogramChart
                  title={t("Items per order", "عدد المنتجات في كل طلب")}
                  description={t("Frequency distribution based on ordered item quantities.", "توزيع تكراري للكميات المطلوبة في الطلبات.")}
                  values={itemCounts}
                  emptyLabel={t("No order items to chart.", "لا توجد منتجات في الطلبات لعرضها.")}
                />
                <HorizontalBarChart
                  title={t("Orders by store", "الطلبات حسب المتجر")}
                  description={t("Stores with the most vendor orders in your history.", "المتاجر ذات أكبر عدد من طلبات البائع في سجلك.")}
                  data={storeOrders}
                  emptyLabel={t("No store orders to chart.", "لا توجد طلبات متاجر لعرضها.")}
                />
                <ColumnChart
                  title={t("Monthly orders", "الطلبات الشهرية")}
                  data={monthlyOrders}
                  emptyLabel={t("No monthly orders to chart.", "لا توجد طلبات شهرية لعرضها.")}
                />
              </div>
            ) : (
              <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
                {t("Your order charts will appear here after your first order.", "ستظهر مخططات الطلبات هنا بعد إتمام أول طلب.")}
              </p>
            )}
          </section>
        )}

        {loading ? (
          <p role="status" className="mt-8">{t("Loading profile…", "جارٍ تحميل الملف الشخصي…")}</p>
        ) : profile ? (
          <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mb-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}
            <form onSubmit={save} className="space-y-5">
              <label className="block text-sm font-medium">
                {t("Display name", "الاسم المعروض")}
                <input className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" value={name} onChange={(event) => setName(event.target.value)} required minLength={1} maxLength={80} />
              </label>
              <label className="block text-sm font-medium">
                {t("Email address", "البريد الإلكتروني")}
                <input className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3" value={profile.email} readOnly />
              </label>
              <div className="text-xs text-[var(--muted)]">{t("Account status:", "حالة الحساب:")} {profile.status}</div>
              <button disabled={busy} className="rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? t("Saving…", "جارٍ الحفظ…") : t("Save changes", "حفظ التغييرات")}
              </button>
            </form>
            <div className="mt-8 border-t border-[var(--border)] pt-5">
              <Link href="/account/addresses" className="font-semibold text-[var(--color-ink-600)]">
                {t("Manage saved addresses →", "إدارة العناوين المحفوظة ←")}
              </Link>
            </div>
          </section>
        ) : (
          <p role="alert" className="mt-8">{error || t("Profile unavailable.", "الملف الشخصي غير متاح.")}</p>
        )}
      </div>
    </main>
  );
}
