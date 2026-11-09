"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type SellerStore = { id: string; name: string; isOwner: boolean };
type CommissionTotal = { currencyCode: string; minorUnit: number; baseAmountMinor: string; commissionMinor: string; transactionCount: number };
type CommissionTransaction = {
  id: string; orderNumber: string; orderStatus: string; productName: string; sku: string;
  quantity: number; categoryName: string | null; rateBasisPoints: number;
  baseAmountMinor: string; commissionMinor: string; currencyCode: string; minorUnit: number; createdAt: string;
};
type CompletedRefundTotal = { currencyCode: string; minorUnit: number; amountMinor: string; itemCount: number };
type CompletedRefund = { id: string; orderNumber: string; productName: string; sku: string; quantity: number; amountMinor: string; currencyCode: string; minorUnit: number; completedAt: string | null };
type CommissionResponse = { store: { id: string; name: string }; limit: number; nextCursor: string | null; totals: CommissionTotal[]; completedRefundTotals: CompletedRefundTotal[]; completedRefunds: CompletedRefund[]; transactions: CommissionTransaction[] };

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+@\- \t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function downloadCommissionCsv(data: CommissionResponse) {
  const rows: Array<Array<string | number>> = [
    ["SECTION", "CURRENCY", "BASE_AMOUNT_MINOR", "COMMISSION_MINOR", "TRANSACTION_COUNT"],
    ...data.totals.map((total) => ["ALL_TIME_TOTAL", total.currencyCode, total.baseAmountMinor, total.commissionMinor, total.transactionCount]),
    [],
    ["SECTION", "DATE", "ORDER", "PRODUCT", "SKU", "CATEGORY", "QUANTITY", "RATE_BPS", "BASE_AMOUNT_MINOR", "COMMISSION_MINOR", "CURRENCY", "ORDER_STATUS"],
    ...data.transactions.map((item) => [
      "COMMISSION_DETAIL", item.createdAt, item.orderNumber, item.productName, item.sku,
      item.categoryName ?? "", item.quantity, item.rateBasisPoints, item.baseAmountMinor,
      item.commissionMinor, item.currencyCode, item.orderStatus
    ]),
    [],
    ["SECTION", "ORDER", "PRODUCT", "SKU", "QUANTITY", "REFUND_AMOUNT_MINOR", "CURRENCY", "COMPLETED_AT"],
    ...data.completedRefunds.map((item) => [
      "COMPLETED_REFUND_DETAIL", item.orderNumber, item.productName, item.sku,
      item.quantity, item.amountMinor, item.currencyCode, item.completedAt ?? ""
    ]),
    ...data.completedRefundTotals.map((item) => [
      "COMPLETED_REFUND_TOTAL", "", "", "", item.itemCount, item.amountMinor, item.currencyCode, ""
    ])
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "seller-commission-statements.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatMinor(value: string, currency: string, minorUnit: number, locale: string) {
  const amount = BigInt(value);
  const scale = 10n ** BigInt(minorUnit);
  const whole = amount / scale;
  const fraction = amount % scale;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency", currency, minimumFractionDigits: minorUnit, maximumFractionDigits: minorUnit
  });
  if (minorUnit === 0) return formatter.format(whole);
  const digitFormatter = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 0 });
  const localizedFraction = digitFormatter.format(fraction).padStart(minorUnit, digitFormatter.format(0));
  return formatter.formatToParts(whole).map((part) =>
    part.type === "fraction" ? localizedFraction : part.value
  ).join("");
}

export default function SellerCommissionsPage() {
  const { locale } = useLocale();
  const [stores, setStores] = useState<SellerStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [data, setData] = useState<CommissionResponse | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/seller/stores", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { stores?: SellerStore[]; error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر."));
        if (!active) return;
        const available = result.stores ?? [];
        setStores(available);
        setStoreId(available.find((store) => store.isOwner)?.id ?? available[0]?.id ?? "");
        if (!available.length) setError(translate(locale, "No seller stores are available for this account.", "لا توجد متاجر بائع متاحة لهذا الحساب."));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر."));
      })
      .finally(() => { if (active) setLoadingStores(false); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!storeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear a previous store's financial statement when no store is selected.
      setData(null);
      return;
    }
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prevent one store's commission statement flashing under another store.
    setData(null);
    setLoading(true);
    setError("");
    void fetch(`/api/seller/commissions?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as CommissionResponse & { error?: string };
        if (!response.ok) throw new Error(result.error || translate(locale, "Unable to load commission statements.", "تعذر تحميل كشوف العمولات."));
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) { setData(null); setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load commission statements.", "تعذر تحميل كشوف العمولات.")); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, locale]);

  async function loadOlderCommissionRows() {
    if (!storeId || !data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const query = new URLSearchParams({ storeId, cursor: data.nextCursor });
      const response = await fetch(`/api/seller/commissions?${query.toString()}`, { cache: "no-store" });
      const result = await response.json() as CommissionResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || translate(locale, "Unable to load older commission rows.", "تعذر تحميل سجلات العمولات الأقدم."));
      if (result.store.id !== storeId) return;
      setData((current) => current && current.store.id === storeId ? {
        ...current,
        nextCursor: result.nextCursor,
        transactions: [...current.transactions, ...result.transactions]
      } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load older commission rows.", "تعذر تحميل سجلات العمولات الأقدم."));
    } finally {
      setLoadingMore(false);
    }
  }

  const storeOptions = useMemo(() => stores.map((store) => ({ value: store.id, label: store.name })), [stores]);
  const t = (en: string, ar: string) => translate(locale, en, ar);

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#dbe6eb_0%,#cbd9e0_48%,#e5edf0_100%)] px-4 py-7 text-[#1d3448] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[28px] border border-white/90 bg-[linear-gradient(115deg,#dcebef_0%,#c5dbe2_48%,#e2e5ef_100%)] p-5 shadow-[12px_14px_28px_rgba(38,66,84,.13),inset_0_2px_0_white,inset_0_-3px_8px_rgba(57,86,105,.06)] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#628493]">{t("SELLER FINANCE", "مالية البائع")}</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-[#46516b] sm:text-3xl">{t("Commission statements", "كشوف العمولات")}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d788a]">{t("A read-only breakdown of commission snapshots recorded against paid order items. It explains the platform fee; it is not a withdrawable balance or payout statement.", "تفصيل للقراءة فقط للعمولات المسجلة على عناصر الطلبات المدفوعة. يوضح رسوم المنصة، ولا يمثل رصيدًا قابلاً للسحب أو كشف دفعات.")}</p>
            </div>
            {stores.length > 1 && <label className="grid min-w-[220px] gap-1 text-xs font-bold text-[#42677b]">{t("Store", "المتجر")}<select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-xl border border-white bg-[linear-gradient(145deg,#f5f2fb,#e8e5f2)] px-3 py-2.5 text-sm text-[#46516b] shadow-[inset_0_2px_5px_rgba(74,75,112,.08)]">{storeOptions.map((store) => <option key={store.value} value={store.value}>{store.label}</option>)}</select></label>}
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {(loadingStores || loading) && <p role="status" className="mt-5 rounded-2xl border border-white bg-white/75 p-4 text-sm text-[#5d788a]">{t("Loading commission statements…", "جارٍ تحميل كشوف العمولات…")}</p>}

        {data && !loading && <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-extrabold text-[#46516b]">{data.store.name}</h2><p className="mt-1 text-xs text-[#8790a5]">{t("Loaded", "تم تحميل")} {data.transactions.length} {t("commission detail rows", "سجل تفصيلي للعمولات")}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white bg-white/70 px-3 py-1.5 text-xs font-bold text-[#42677b]">{data.transactions.length} {t("detail rows", "تفصيل")}</span>
              <button type="button" onClick={() => downloadCommissionCsv(data)} className="rounded-xl border border-white bg-white/75 px-4 py-2 text-xs font-extrabold text-[#526078] shadow-[0_3px_8px_rgba(38,66,84,.08)] transition hover:bg-white">{t("Export CSV", "تصدير CSV")}</button>
            </div>
          </div>

          {data.totals.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.totals.map((total) => <section key={total.currencyCode} className="rounded-[24px] border border-white/90 bg-[linear-gradient(145deg,#e9edf2,#c9d9e2)] p-5 shadow-[8px_10px_20px_rgba(38,66,84,.1),inset_0_2px_0_white,inset_0_-3px_7px_rgba(57,86,105,.07)]">
              <p className="text-xs font-bold text-[#628493]">{t("All-time recorded order item base", "إجمالي قيمة عناصر الطلب المسجلة")} · {total.currencyCode}</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#46516b]">{formatMinor(total.baseAmountMinor, total.currencyCode, total.minorUnit, locale)}</p>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/70 pt-3"><div><p className="text-[11px] text-[#8790a5]">{t("All-time recorded platform commission", "إجمالي عمولة المنصة المسجلة")}</p><p className="mt-1 text-lg font-extrabold text-[#42677b]">{formatMinor(total.commissionMinor, total.currencyCode, total.minorUnit, locale)}</p></div><p className="text-xs font-semibold text-[#8790a5]">{total.transactionCount} {t("items", "عنصر")}</p></div>
            </section>)}
          </div>}

          {data.completedRefundTotals.length > 0 && <section className="mt-6 rounded-[24px] border border-white/90 bg-[linear-gradient(145deg,#f5e9e6,#e9d7d2)] p-5 shadow-[8px_10px_20px_rgba(38,66,84,.08),inset_0_2px_0_white]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-extrabold text-[#5b4140]">{t("Completed customer refunds", "المبالغ المستردة للعملاء")}</h2><p className="mt-1 text-xs leading-5 text-[#866d69]">{t("Refund item allocations attributed to this store after finance confirms the refund. These are shown separately and are not deducted from seller earnings here.", "تخصيصات مبالغ الاسترداد لعناصر هذا المتجر بعد تأكيد المالية للاسترداد. تُعرض منفصلة ولا تُخصم من أرباح البائع هنا.")}</p></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.completedRefundTotals.map((total) => <div key={total.currencyCode} className="rounded-2xl border border-white/80 bg-white/55 p-4">
                <p className="text-xs font-bold text-[#866d69]">{t("Refunded to customers", "المسترد للعملاء")} · {total.currencyCode}</p>
                <p className="mt-2 text-xl font-black tabular-nums text-[#5b4140]">{formatMinor(total.amountMinor, total.currencyCode, total.minorUnit, locale)}</p>
                <p className="mt-1 text-[11px] text-[#866d69]">{total.itemCount} {t("returned item allocations", "تخصيص استرداد للعناصر")}</p>
              </div>)}
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/70 bg-white/40">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-[#866d69]"><tr><th className="px-3 py-3">{t("Order", "الطلب")}</th><th className="px-3 py-3">{t("Product", "المنتج")}</th><th className="px-3 py-3">{t("Qty", "الكمية")}</th><th className="px-3 py-3">{t("Refunded", "المبلغ المسترد")}</th><th className="px-3 py-3">{t("Completed", "تاريخ الإتمام")}</th></tr></thead>
                <tbody className="divide-y divide-white/70">{data.completedRefunds.map((item) => <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-[#5b4140]">{item.orderNumber}</td><td className="px-3 py-3"><p className="font-semibold">{item.productName}</p><p className="mt-1 text-[10px]">{item.sku}</p></td><td className="px-3 py-3 tabular-nums">{item.quantity}</td><td className="px-3 py-3 font-bold tabular-nums">{formatMinor(item.amountMinor, item.currencyCode, item.minorUnit, locale)}</td><td className="px-3 py-3">{item.completedAt ? new Date(item.completedAt).toLocaleDateString(locale) : "—"}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#866d69]">{t("The refund detail list is limited to the latest 100 completed allocations; the totals above cover all completed allocations currently recorded for this store.", "قائمة تفاصيل الاسترداد محدودة بأحدث 100 تخصيص مكتمل؛ أما الإجماليات فتشمل جميع التخصيصات المكتملة المسجلة لهذا المتجر.")}</p>
          </section>}

          <section className="mt-6 overflow-hidden rounded-[24px] border border-white/90 bg-[linear-gradient(145deg,#f1eff8,#e1dfed)] shadow-[10px_12px_24px_rgba(38,66,84,.1),inset_0_2px_0_white]">
            <div className="border-b border-white/80 p-5"><h2 className="font-extrabold text-[#46516b]">{t("Commission history", "سجل العمولات")}</h2><p className="mt-1 text-xs text-[#8790a5]">{t("The immutable rate and amount snapshot recorded for each order item.", "لقطة النسبة والمبلغ المحفوظة لكل عنصر طلب.")}</p></div>
            {data.transactions.length === 0 ? <p className="p-10 text-center text-sm text-[#8790a5]">{t("No commission snapshots have been recorded for this store yet.", "لم تُسجل أي لقطات عمولة لهذا المتجر بعد.")}</p> : <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-white/55 text-[11px] font-bold uppercase tracking-wide text-[#8790a5]"><tr>
                  <th className="px-4 py-3">{t("Date", "التاريخ")}</th><th className="px-4 py-3">{t("Order", "الطلب")}</th><th className="px-4 py-3">{t("Product", "المنتج")}</th><th className="px-4 py-3">{t("Category", "الفئة")}</th><th className="px-4 py-3">{t("Qty", "الكمية")}</th><th className="px-4 py-3">{t("Rate", "النسبة")}</th><th className="px-4 py-3">{t("Base", "الأساس")}</th><th className="px-4 py-3">{t("Commission", "العمولة")}</th><th className="px-4 py-3">{t("Order status", "حالة الطلب")}</th>
                </tr></thead>
                <tbody className="divide-y divide-white/80">
                  {data.transactions.map((item) => <tr key={item.id} className="align-top hover:bg-white/35">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#8790a5]">{new Date(item.createdAt).toLocaleDateString(locale)}</td>
                    <td className="px-4 py-3 font-bold text-[#526078]">{item.orderNumber}</td>
                    <td className="px-4 py-3"><p className="font-semibold text-[#46516b]">{item.productName}</p><p className="mt-1 text-[11px] text-[#8790a5]">{item.sku}</p></td>
                    <td className="px-4 py-3 text-xs text-[#5d788a]">{item.categoryName || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 tabular-nums">{(item.rateBasisPoints / 100).toFixed(2)}%</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatMinor(item.baseAmountMinor, item.currencyCode, item.minorUnit, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-[#526078]">{formatMinor(item.commissionMinor, item.currencyCode, item.minorUnit, locale)}</td>
                    <td className="px-4 py-3 text-xs">{item.orderStatus}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
            {data.nextCursor && <div className="border-t border-white/80 p-4 text-center">
              <button type="button" onClick={() => void loadOlderCommissionRows()} disabled={loadingMore} className="rounded-xl border border-white bg-white/80 px-5 py-2.5 text-xs font-extrabold text-[#526078] shadow-[0_3px_8px_rgba(38,66,84,.08)] disabled:opacity-60">
                {loadingMore ? t("Loading…", "جارٍ التحميل…") : t("Load older commission records", "تحميل سجلات العمولات الأقدم")}
              </button>
            </div>}
          </section>
          <p className="mt-4 rounded-xl border border-[#9bbbc7] bg-white/55 p-4 text-xs leading-5 text-[#8790a5]">{t("Totals aggregate every commission snapshot currently recorded for this store, grouped by currency. The table loads commission details in pages of 100. These figures are not seller net balances or withdrawable funds; refunds are now shown separately; adjustments, holds, seller ledger balances and payouts are not yet represented.", "تجمع الإجماليات كل لقطات العمولات المسجلة حالياً لهذا المتجر حسب العملة، ويحمّل الجدول التفاصيل على صفحات من 100 سجل. هذه الأرقام ليست صافي مستحقات البائع أو أموالاً قابلة للسحب؛ ولا تزال التسويات والمبالغ المحجوزة وأرصدة دفتر البائع والدفعات غير ممثلة في دفتر محاسبي متكامل.")}</p>
        </>}
      </div>
    </main>
  );
}
