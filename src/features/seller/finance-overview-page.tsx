"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type SellerStore = { id: string; name: string; isOwner: boolean };
type MoneyTotal = { currencyCode: string; minorUnit: number; baseAmountMinor?: string; commissionMinor?: string; amountMinor?: string; transactionCount?: number; itemCount?: number };
type FinanceData = {
  store: { id: string; name: string };
  totals: MoneyTotal[];
  completedRefundTotals: MoneyTotal[];
  transactions: Array<{ id: string; orderNumber: string; productName: string; commissionMinor: string; currencyCode: string; minorUnit: number; createdAt: string }>;
};
function formatMinor(value: string, currency: string, minorUnit: number, locale: string) {
  const amount = BigInt(value);
  const scale = 10n ** BigInt(minorUnit);
  const whole = amount / scale;
  const fraction = amount % scale;
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: minorUnit, maximumFractionDigits: minorUnit });
  if (minorUnit === 0) return formatter.format(whole);
  const digits = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 0 });
  const fractionText = digits.format(fraction).padStart(minorUnit, digits.format(0));
  return formatter.formatToParts(whole).map((part) => part.type === "fraction" ? fractionText : part.value).join("");
}
export default function SellerFinanceOverviewPage() {
  const { locale } = useLocale();
  const [stores, setStores] = useState<SellerStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const t = useCallback((en: string, ar: string) => translate(locale, en, ar), [locale]);

  useEffect(() => {
    let active = true;
    fetch("/api/seller/stores", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { stores?: SellerStore[]; error?: string };
        if (!response.ok) throw new Error(result.error || t("Unable to load stores.", "تعذر تحميل المتاجر."));
        if (!active) return;
        const available = result.stores ?? [];
        setStores(available);
        setStoreId(available.find((store) => store.isOwner)?.id ?? available[0]?.id ?? "");
        if (!available.length) setError(t("No seller stores are available.", "لا توجد متاجر بائع متاحة."));
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("Unable to load stores.", "تعذر تحميل المتاجر.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale, t]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    fetch(`/api/seller/commissions?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as FinanceData & { error?: string };
        if (!response.ok) throw new Error(result.error || t("Unable to load financial summary.", "تعذر تحميل الملخص المالي."));
        if (active) setData(result);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t("Unable to load financial summary.", "تعذر تحميل الملخص المالي.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, locale, t]);

  const storeOptions = useMemo(() => stores.map((store) => ({ id: store.id, name: store.name })), [stores]);
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[30px] border border-[#eee9e4] bg-white p-6 text-[#454545] shadow-[0_12px_28px_rgba(69,69,69,.07)] sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#625b55]">{t("SELLER FINANCE", "مالية البائع")}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-black tracking-tight">{t("Financial overview", "الملخص المالي")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#77716c]">{t("Review recorded sales, platform commissions and completed refunds without mixing currencies.", "راجع المبيعات المسجلة وعمولات المنصة والمبالغ المستردة المكتملة دون خلط العملات.")}</p></div>
          <div className="flex flex-wrap gap-2">
            {stores.find((store) => store.id === storeId)?.isOwner && <a href={`/api/seller/stores/${encodeURIComponent(storeId)}/export`} className="rounded-2xl border border-[var(--action)] bg-[var(--action)] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(255,140,28,.18)] transition-colors hover:border-[var(--action-hover)] hover:bg-[var(--action-hover)] hover:text-white">{t("Export store to Excel", "تصدير المتجر إلى Excel")} ↓</a>}
            <Link href="/seller/commissions" className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)] shadow-[0_4px_12px_rgba(69,69,69,.06)] transition-colors hover:border-[var(--action)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgba(255,140,28,.08)]">{t("Open commission statements", "فتح كشوف العمولات")} ↗</Link>
            <Link href="/seller/payouts" className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground)] shadow-[0_4px_12px_rgba(69,69,69,.06)] transition-colors hover:border-[var(--action)] hover:bg-white hover:text-[var(--foreground)] hover:shadow-[0_4px_12px_rgba(255,140,28,.08)]">{t("Manage bank accounts", "إدارة الحسابات البنكية")} ↗</Link>
          </div>
        </div>
      </header>
      <section className="rounded-[26px] border border-[#eee9e4] bg-[#fffaf6] p-5 shadow-[0_6px_18px_rgba(69,69,69,.05)]">
        <label className="grid max-w-md gap-2 text-sm font-bold text-[#5f5a55]">{t("Store", "المتجر")}
          <select value={storeId} onChange={(event) => { setData(null); setLoading(Boolean(event.target.value)); setError(""); setStoreId(event.target.value); }} disabled={!storeOptions.length} className="rounded-xl border border-[#eee9e4] bg-white px-3 py-3 text-sm text-[#454545] shadow-sm outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-[#FF8C1C]/10">
            {storeOptions.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </label>
      </section>
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {loading ? <div className="rounded-2xl border border-white bg-white/60 p-8 text-sm text-[#77716c]">{t("Loading financial records…", "جارٍ تحميل السجلات المالية…")}</div>
        : data ? <>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-[25px] border border-[#eee9e4] bg-white p-5 text-[#454545] shadow-[0_8px_22px_rgba(69,69,69,.06)]">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[#a94308]">{t("Sales in commission records", "المبيعات ضمن سجلات العمولات")}</p>
              {data.totals.length ? data.totals.map((item) => <p key={item.currencyCode} className="mt-3 text-xl font-black tabular-nums">{formatMinor(item.baseAmountMinor ?? "0", item.currencyCode, item.minorUnit, locale)} <span className="text-xs font-semibold">{item.transactionCount ?? 0} {t("items", "عملية")}</span></p>) : <p className="mt-3 text-sm">{t("No commissionable sales records yet.", "لا توجد مبيعات مؤهلة مسجلة بعد.")}</p>}
            </article>
            <article className="rounded-[25px] border border-[#eee9e4] bg-white p-5 text-[#454545] shadow-[0_8px_22px_rgba(69,69,69,.06)]">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[#a94308]">{t("Recorded platform commissions", "عمولات المنصة المسجلة")}</p>
              {data.totals.length ? data.totals.map((item) => <p key={item.currencyCode} className="mt-3 text-xl font-black tabular-nums">{formatMinor(item.commissionMinor ?? "0", item.currencyCode, item.minorUnit, locale)}</p>) : <p className="mt-3 text-sm">{t("No commission records yet.", "لا توجد عمولات مسجلة بعد.")}</p>}
            </article>
            <article className="rounded-[25px] border border-[#eee9e4] bg-white p-5 text-[#454545] shadow-[0_8px_22px_rgba(69,69,69,.06)]">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[#a94308]">{t("Completed refunds", "المبالغ المستردة المكتملة")}</p>
              {data.completedRefundTotals.length ? data.completedRefundTotals.map((item) => <p key={item.currencyCode} className="mt-3 text-xl font-black tabular-nums">{formatMinor(item.amountMinor ?? "0", item.currencyCode, item.minorUnit, locale)} <span className="text-xs font-semibold">{item.itemCount ?? 0} {t("items", "عنصر")}</span></p>) : <p className="mt-3 text-sm">{t("No completed refunds recorded.", "لا توجد مبالغ مستردة مكتملة.")}</p>}
            </article>
          </div>
          <section className="rounded-[26px] border border-[#eee9e4] bg-[#fffaf6] p-5 shadow-[0_6px_18px_rgba(69,69,69,.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#454545]">{t("Latest commission activity", "أحدث حركات العمولات")}</h2><p className="mt-1 text-xs text-[#77716c]">{t("Latest records available for this store.", "أحدث السجلات المتاحة لهذا المتجر.")}</p></div><Link href="/seller/commissions" className="text-sm font-bold text-[#a94308] underline underline-offset-4">{t("View full statement", "عرض الكشف الكامل")}</Link></div>
            {data.transactions.length ? <div className="mt-4 divide-y divide-white/80">{data.transactions.slice(0, 6).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-[#454545]">{item.productName}</p><p className="mt-1 text-xs text-[#625b55]">#{item.orderNumber} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.createdAt))}</p></div><p className="text-sm font-black tabular-nums text-[#454545]">{formatMinor(item.commissionMinor, item.currencyCode, item.minorUnit, locale)}</p></div>)}</div> : <p className="mt-4 rounded-xl bg-white/60 p-5 text-sm text-[#77716c]">{t("Commission activity will appear here when eligible orders are recorded.", "ستظهر حركات العمولات هنا عند تسجيل طلبات مؤهلة.")}</p>}
          </section>
          <p className="rounded-2xl border border-[#e7dcb8] bg-[#fbf5df] p-4 text-sm leading-6 text-[#786a43]">{t("Important: these are separate recorded sales, commission and refund figures—not a payable balance. You can save an encrypted payout destination, but beneficiary verification, seller ledger, holds, settlement and withdrawal execution are not yet available. No available-to-withdraw amount is shown.", "تنبيه: هذه أرقام منفصلة للمبيعات والعمولات والمبالغ المستردة المسجلة وليست رصيداً مستحقاً للدفع. يمكنك حفظ حساب استلام مشفّر، لكن التحقق من ملكية المستفيد ودفتر حسابات البائع والحجوزات والتسويات وتنفيذ السحب لم تُفعّل بعد. لذلك لا نعرض مبلغاً قابلاً للسحب.")}</p>
        </> : null}
      {!loading && !data && !error && <p className="rounded-2xl bg-white/60 p-6 text-sm text-[#77716c]">{t("Select a store to view its financial summary.", "اختر متجراً لعرض ملخصه المالي.")}</p>}
    </main>
  );
}
