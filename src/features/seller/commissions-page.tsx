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
type CommissionResponse = { store: { id: string; name: string }; limit: number; totals: CommissionTotal[]; transactions: CommissionTransaction[] };

function formatMinor(value: string, currency: string, minorUnit: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency", currency, minimumFractionDigits: minorUnit, maximumFractionDigits: minorUnit
  }).format(Number(value) / (10 ** minorUnit));
}

export default function SellerCommissionsPage() {
  const { locale } = useLocale();
  const [stores, setStores] = useState<SellerStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [data, setData] = useState<CommissionResponse | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loading, setLoading] = useState(false);
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

  const storeOptions = useMemo(() => stores.map((store) => ({ value: store.id, label: store.name })), [stores]);
  const t = (en: string, ar: string) => translate(locale, en, ar);

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#dbe6eb_0%,#cbd9e0_48%,#e5edf0_100%)] px-4 py-7 text-[#1d3448] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[28px] border border-white/90 bg-[linear-gradient(115deg,#dcebef_0%,#c5dbe2_48%,#e2e5ef_100%)] p-5 shadow-[12px_14px_28px_rgba(38,66,84,.13),inset_0_2px_0_white,inset_0_-3px_8px_rgba(57,86,105,.06)] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#628493]">{t("SELLER FINANCE", "مالية البائع")}</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-[#263d50] sm:text-3xl">{t("Commission statements", "كشوف العمولات")}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d788a]">{t("A read-only breakdown of commission snapshots recorded against paid order items. It explains the platform fee; it is not a withdrawable balance or payout statement.", "تفصيل للقراءة فقط للعمولات المسجلة على عناصر الطلبات المدفوعة. يوضح رسوم المنصة، ولا يمثل رصيدًا قابلاً للسحب أو كشف دفعات.")}</p>
            </div>
            {stores.length > 1 && <label className="grid min-w-[220px] gap-1 text-xs font-bold text-[#42677b]">{t("Store", "المتجر")}<select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="rounded-xl border border-white bg-[linear-gradient(145deg,#f7fbfc,#e8f0f3)] px-3 py-2.5 text-sm text-[#263d50] shadow-[inset_0_2px_5px_rgba(43,69,88,.08)]">{storeOptions.map((store) => <option key={store.value} value={store.value}>{store.label}</option>)}</select></label>}
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {(loadingStores || loading) && <p role="status" className="mt-5 rounded-2xl border border-white bg-white/75 p-4 text-sm text-[#5d788a]">{t("Loading commission statements…", "جارٍ تحميل كشوف العمولات…")}</p>}

        {data && !loading && <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-extrabold text-[#263d50]">{data.store.name}</h2><p className="mt-1 text-xs text-[#718899]">{t("Latest", "أحدث")} {data.limit} {t("commission snapshots", "لقطة عمولة")}</p></div>
            <span className="rounded-full border border-white bg-white/70 px-3 py-1.5 text-xs font-bold text-[#42677b]">{data.transactions.length} {t("records", "سجل")}</span>
          </div>

          {data.totals.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.totals.map((total) => <section key={total.currencyCode} className="rounded-[24px] border border-white/90 bg-[linear-gradient(145deg,#e9edf2,#c9d9e2)] p-5 shadow-[8px_10px_20px_rgba(38,66,84,.1),inset_0_2px_0_white,inset_0_-3px_7px_rgba(57,86,105,.07)]">
              <p className="text-xs font-bold text-[#628493]">{t("Order item base amount", "قيمة عناصر الطلب قبل العمولة")} · {total.currencyCode}</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#263d50]">{formatMinor(total.baseAmountMinor, total.currencyCode, total.minorUnit, locale)}</p>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/70 pt-3"><div><p className="text-[11px] text-[#718899]">{t("Platform commission", "عمولة المنصة")}</p><p className="mt-1 text-lg font-extrabold text-[#42677b]">{formatMinor(total.commissionMinor, total.currencyCode, total.minorUnit, locale)}</p></div><p className="text-xs font-semibold text-[#718899]">{total.transactionCount} {t("items", "عنصر")}</p></div>
            </section>)}
          </div>}

          <section className="mt-6 overflow-hidden rounded-[24px] border border-white/90 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] shadow-[10px_12px_24px_rgba(38,66,84,.1),inset_0_2px_0_white]">
            <div className="border-b border-white/80 p-5"><h2 className="font-extrabold text-[#263d50]">{t("Commission history", "سجل العمولات")}</h2><p className="mt-1 text-xs text-[#718899]">{t("The immutable rate and amount snapshot recorded for each order item.", "لقطة النسبة والمبلغ المحفوظة لكل عنصر طلب.")}</p></div>
            {data.transactions.length === 0 ? <p className="p-10 text-center text-sm text-[#718899]">{t("No commission snapshots have been recorded for this store yet.", "لم تُسجل أي لقطات عمولة لهذا المتجر بعد.")}</p> : <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-white/55 text-[11px] font-bold uppercase tracking-wide text-[#718899]"><tr>
                  <th className="px-4 py-3">{t("Date", "التاريخ")}</th><th className="px-4 py-3">{t("Order", "الطلب")}</th><th className="px-4 py-3">{t("Product", "المنتج")}</th><th className="px-4 py-3">{t("Category", "الفئة")}</th><th className="px-4 py-3">{t("Qty", "الكمية")}</th><th className="px-4 py-3">{t("Rate", "النسبة")}</th><th className="px-4 py-3">{t("Base", "الأساس")}</th><th className="px-4 py-3">{t("Commission", "العمولة")}</th><th className="px-4 py-3">{t("Order status", "حالة الطلب")}</th>
                </tr></thead>
                <tbody className="divide-y divide-white/80">
                  {data.transactions.map((item) => <tr key={item.id} className="align-top hover:bg-white/35">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#718899]">{new Date(item.createdAt).toLocaleDateString(locale)}</td>
                    <td className="px-4 py-3 font-bold text-[#35566b]">{item.orderNumber}</td>
                    <td className="px-4 py-3"><p className="font-semibold text-[#263d50]">{item.productName}</p><p className="mt-1 text-[11px] text-[#718899]">{item.sku}</p></td>
                    <td className="px-4 py-3 text-xs text-[#5d788a]">{item.categoryName || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 tabular-nums">{(item.rateBasisPoints / 100).toFixed(2)}%</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatMinor(item.baseAmountMinor, item.currencyCode, item.minorUnit, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums text-[#35566b]">{formatMinor(item.commissionMinor, item.currencyCode, item.minorUnit, locale)}</td>
                    <td className="px-4 py-3 text-xs">{item.orderStatus}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
          </section>
          <p className="mt-4 rounded-xl border border-[#9bbbc7] bg-white/55 p-4 text-xs leading-5 text-[#718899]">{t("Important: totals cover only the latest 100 commission snapshots. This view does not calculate seller net balances, withdrawals, payout status, or later refund/adjustment entries. Those require the platform accounting and payout ledger.", "مهم: الإجماليات تغطي أحدث 100 لقطة عمولة فقط. لا يحسب هذا العرض صافي رصيد البائع أو السحوبات أو حالة الدفعات أو تسويات الاسترداد اللاحقة؛ فهذه تتطلب دفتر المحاسبة والدفعات في المنصة.")}</p>
        </>}
      </div>
    </main>
  );
}
