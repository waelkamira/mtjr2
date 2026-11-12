"use client";

import { StatusBadge } from "@/components/status-badge";
import { formatMinorUnits } from "@/lib/money";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Rule = {
  id: string;
  scope: string;
  sellerId: string | null;
  sellerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  rateBasisPoints: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
};
type SellerOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };
type CommissionRow = {
  id: string;
  order: { orderNumber: string };
  store: { name: string };
  sellerName: string;
  categoryName: string | null;
  ruleScopeType: string;
  rateBasisPoints: number;
  baseAmountMinor: string;
  commissionMinor: string;
  currencyCode: string;
  currencyMinorUnit: number;
  createdAt: string;
};

function localDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function scopeLabel(locale: ReturnType<typeof useLocale>["locale"], rule: Pick<Rule, "scope" | "sellerName" | "categoryName">) {
  if (rule.scope === "SELLER_CATEGORY") return `${rule.sellerName} · ${rule.categoryName}`;
  if (rule.scope === "SELLER") return rule.sellerName || translate(locale, "Seller", "البائع");
  if (rule.scope === "CATEGORY") return rule.categoryName || translate(locale, "Category", "الفئة");
  return translate(locale, "Global", "عام");
}

function formatMinorAmount(amountMinor: string, currencyCode: string, minorUnit: number) {
  return formatMinorUnits(amountMinor, currencyCode, minorUnit);
}

export default function CommissionsPage() {
  const { locale } = useLocale();
  const [rules, setRules] = useState<Rule[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [transactions, setTransactions] = useState<CommissionRow[]>([]);
  const [scope, setScope] = useState("GLOBAL");
  const [sellerId, setSellerId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ratePercent, setRatePercent] = useState("0.00");
  const [effectiveFrom, setEffectiveFrom] = useState(() => localDateTimeValue(new Date()));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [rulesResponse, transactionsResponse] = await Promise.all([
      fetch("/api/admin/commission-rules", { cache: "no-store" }),
      fetch("/api/admin/commissions?limit=25&page=1", { cache: "no-store" })
    ]);
    const rulesData = await rulesResponse.json() as { rules?: Rule[]; sellers?: SellerOption[]; categories?: CategoryOption[]; error?: string };
    const transactionsData = await transactionsResponse.json() as { items?: CommissionRow[]; error?: string };
    if (!rulesResponse.ok) throw new Error(rulesData.error || translate(locale, "Commission rules are unavailable.", "قواعد العمولات غير متاحة."));
    if (!transactionsResponse.ok) throw new Error(transactionsData.error || translate(locale, "Commission transactions are unavailable.", "معاملات العمولات غير متاحة."));
    setRules(rulesData.rules || []);
    setSellers(rulesData.sellers || []);
    setCategories(rulesData.categories || []);
    setTransactions(transactionsData.items || []);
  }, [locale]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Commission data is unavailable.", "بيانات العمولات غير متاحة."));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [load, locale]);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const basisPoints = Math.round(Number(ratePercent) * 100);
    if (!Number.isFinite(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
      setError(translate(locale, "Enter a commission rate from 0% through 100%.", "أدخل معدل عمولة من 0٪ إلى 100٪."));
      return;
    }
    if ((scope === "SELLER" || scope === "SELLER_CATEGORY") && !sellerId) {
      setError(translate(locale, "Select a seller for this rule.", "اختر بائعًا لهذه القاعدة."));
      return;
    }
    if ((scope === "CATEGORY" || scope === "SELLER_CATEGORY") && !categoryId) {
      setError(translate(locale, "Select a category for this rule.", "اختر فئة لهذه القاعدة."));
      return;
    }
    setBusy("create"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/commission-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          ...(scope === "SELLER" || scope === "SELLER_CATEGORY" ? { sellerId } : {}),
          ...(scope === "CATEGORY" || scope === "SELLER_CATEGORY" ? { categoryId } : {}),
          rateBasisPoints: basisPoints,
          effectiveFrom: new Date(effectiveFrom).toISOString(),
          effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Commission rule could not be saved.");
      setNotice(translate(locale, "Commission rule saved. Its rate applies only to payments succeeded during its effective period.", "تم حفظ قاعدة العمولة. يُطبّق معدلها على المدفوعات الناجحة خلال فترة سريانها فقط."));
      toast.success(translate(locale, "Commission rule saved.", "تم حفظ قاعدة العمولة."));
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Commission rule could not be saved.", "تعذر حفظ قاعدة العمولة."); setError(message); toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function deactivate(rule: Rule) {
    const deactivationReason = window.prompt(`${translate(locale, "Why are you deactivating the", "ما سبب إلغاء تفعيل قاعدة")} ${scopeLabel(locale, rule)}?`);
    if (!deactivationReason || deactivationReason.trim().length < 5) return;
    setBusy(rule.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/commission-rules/${encodeURIComponent(rule.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deactivationReason })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Commission rule could not be deactivated.");
      setNotice(translate(locale, "Commission rule deactivated. Existing commission snapshots remain unchanged.", "تم إلغاء تفعيل قاعدة العمولة. لم تتغير سجلات العمولات السابقة."));
      toast.success(translate(locale, "Commission rule deactivated.", "تم إلغاء تفعيل قاعدة العمولة."));
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Commission rule could not be deactivated.", "تعذر إلغاء تفعيل قاعدة العمولة."); setError(message); toast.error(message);
    } finally {
      setBusy("");
    }
  }

  const needsSeller = scope === "SELLER" || scope === "SELLER_CATEGORY";
  const needsCategory = scope === "CATEGORY" || scope === "SELLER_CATEGORY";

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-8">
      <header>
        <p className="text-sm font-semibold text-[var(--color-lavender-700)]">{translate(locale, "Platform finance", "الشؤون المالية للمنصة")}</p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Commissions", "العمولات")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          {translate(locale, "Rates apply to each item's merchandise amount after discounts, excluding shipping and tax. The rate and amount are recorded once when payment succeeds; later rule changes never recalculate past sales.", "تُطبّق المعدلات على قيمة بضائع كل منتج بعد الخصومات، باستثناء الشحن والضريبة. يُسجّل المعدل والمبلغ مرة واحدة عند نجاح الدفع؛ ولا تعيد التغييرات اللاحقة احتساب المبيعات السابقة.")}
        </p>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <section className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-clay-raised">
        <h2 className="text-lg font-semibold">{translate(locale, "Add a commission rule", "إضافة قاعدة عمولة")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Precedence: seller + category, seller, category, then global. Without a matching rule, the saved rate is 0%.", "ترتيب الأولوية: البائع والفئة، ثم البائع، ثم الفئة، ثم القاعدة العامة. عند عدم وجود قاعدة مطابقة، يكون المعدل المحفوظ 0٪.")}</p>
        <form onSubmit={createRule} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">{translate(locale, "Rule scope", "نطاق القاعدة")}
            <select value={scope} onChange={(event) => setScope(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2">
              <option value="GLOBAL">{translate(locale, "Global", "عام")}</option><option value="SELLER">{translate(locale, "Seller", "البائع")}</option><option value="CATEGORY">{translate(locale, "Category", "الفئة")}</option><option value="SELLER_CATEGORY">{translate(locale, "Seller + category", "البائع والفئة")}</option>
            </select>
          </label>
          {needsSeller && <label className="text-sm font-medium">{translate(locale, "Seller", "البائع")}
            <select value={sellerId} onChange={(event) => setSellerId(event.target.value)} required className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2">
              <option value="">{translate(locale, "Select seller", "اختر بائعًا")}</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
          </label>}
          {needsCategory && <label className="text-sm font-medium">{translate(locale, "Category", "الفئة")}
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2">
              <option value="">{translate(locale, "Select category", "اختر فئة")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>}
          <label className="text-sm font-medium">{translate(locale, "Rate (%)", "المعدل (٪)")}
            <input type="number" min="0" max="100" step="0.01" value={ratePercent} onChange={(event) => setRatePercent(event.target.value)} required className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2"/>
          </label>
          <label className="text-sm font-medium">{translate(locale, "Effective from", "ساري من")}
            <input type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2"/>
          </label>
          <label className="text-sm font-medium">{translate(locale, "Effective until (optional)", "ساري حتى (اختياري)")}
            <input type="datetime-local" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2"/>
          </label>
          <div className="flex items-end lg:col-span-3">
            <button disabled={busy !== ""} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "create" ? translate(locale, "Saving…", "جارٍ الحفظ…") : translate(locale, "Save rule", "حفظ القاعدة")}</button>
          </div>
        </form>
      </section>

      <section className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-clay-raised">
        <h2 className="text-lg font-semibold">{translate(locale, "Commission rules", "قواعد العمولات")}</h2>
        {loading ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "Loading rules…", "جارٍ تحميل القواعد…")}</p> : rules.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No rules configured. Successful payments currently receive a 0% commission snapshot.", "لم يتم إعداد قواعد. تحصل المدفوعات الناجحة حاليًا على عمولة مسجلة بنسبة 0٪.")}</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]"><th className="py-3 pr-4">{translate(locale, "Scope", "النطاق")}</th><th className="py-3 pr-4">{translate(locale, "Rate", "المعدل")}</th><th className="py-3 pr-4">{translate(locale, "Effective period", "فترة السريان")}</th><th className="py-3 pr-4">{translate(locale, "Status", "الحالة")}</th><th className="py-3">{translate(locale, "Action", "الإجراء")}</th></tr></thead>
              <tbody>{rules.map((rule) => <tr key={rule.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-orange-50/40">
                <td className="py-3 pr-4 font-medium">{scopeLabel(locale, rule)}</td><td className="py-3 pr-4">{(rule.rateBasisPoints / 100).toFixed(2)}%</td>
                <td className="py-3 pr-4">{new Date(rule.effectiveFrom).toLocaleString()} – {rule.effectiveUntil ? new Date(rule.effectiveUntil).toLocaleString() : translate(locale, "No end", "بلا تاريخ انتهاء")}</td>
                <td className="py-3 pr-4"><StatusBadge locale={locale} status={rule.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                <td className="py-3">{rule.isActive && <button disabled={busy !== ""} onClick={() => void deactivate(rule)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">{busy === rule.id ? translate(locale, "Updating…", "جارٍ التحديث…") : translate(locale, "Deactivate", "إلغاء التفعيل")}</button>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-clay-raised">
        <h2 className="text-lg font-semibold">{translate(locale, "Recent immutable commission snapshots", "سجلات العمولات الحديثة الثابتة")}</h2>
        {loading ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "Loading transactions…", "جارٍ تحميل المعاملات…")}</p> : transactions.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">{translate(locale, "No payment-success commission snapshots yet.", "لا توجد سجلات عمولات لمدفوعات ناجحة بعد.")}</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead><tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]"><th className="py-3 pr-4">{translate(locale, "Order", "الطلب")}</th><th className="py-3 pr-4">{translate(locale, "Seller / store", "البائع / المتجر")}</th><th className="py-3 pr-4">{translate(locale, "Category", "الفئة")}</th><th className="py-3 pr-4">{translate(locale, "Base", "الأساس")}</th><th className="py-3 pr-4">{translate(locale, "Rate", "المعدل")}</th><th className="py-3 pr-4">{translate(locale, "Commission", "العمولة")}</th><th className="py-3">{translate(locale, "Recorded", "تاريخ التسجيل")}</th></tr></thead>
              <tbody>{transactions.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-orange-50/40">
                <td className="py-3 pr-4">{item.order.orderNumber}</td><td className="py-3 pr-4">{item.sellerName} / {item.store.name}</td><td className="py-3 pr-4">{item.categoryName || translate(locale, "Uncategorized", "غير مصنف")}</td>
                <td className="py-3 pr-4">{formatMinorAmount(item.baseAmountMinor, item.currencyCode, item.currencyMinorUnit)}</td><td className="py-3 pr-4">{(item.rateBasisPoints / 100).toFixed(2)}% ({item.ruleScopeType})</td><td className="py-3 pr-4">{formatMinorAmount(item.commissionMinor, item.currencyCode, item.currencyMinorUnit)}</td><td className="py-3">{new Date(item.createdAt).toLocaleString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
