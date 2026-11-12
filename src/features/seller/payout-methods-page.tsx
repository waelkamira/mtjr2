"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type PayoutMethod = {
  id: string; type: "IBAN" | "LOCAL_BANK_ACCOUNT"; accountHolderName: string; bankName: string;
  countryCode: string; currencyCode: string; accountLast4: string;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "DISABLED";
  isDefault: boolean; verifiedAt: string | null; createdAt: string;
};

export default function SellerPayoutMethodsPage() {
  const { locale } = useLocale();
  const t = useCallback((en: string, ar: string) => translate(locale, en, ar), [locale]);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [type, setType] = useState<"IBAN" | "LOCAL_BANK_ACCOUNT">("IBAN");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [routingCode, setRoutingCode] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/seller/payout-methods", { cache: "no-store" });
      const result = await response.json() as { methods?: PayoutMethod[]; error?: string };
      if (!response.ok) throw new Error(result.error || t("Unable to load bank accounts.", "تعذر تحميل الحسابات البنكية."));
      setMethods(result.methods ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to load bank accounts.", "تعذر تحميل الحسابات البنكية."));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/seller/payout-methods", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, accountHolderName, bankName, countryCode, currencyCode, accountIdentifier, routingCode, isDefault })
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || t("Unable to save bank account.", "تعذر حفظ الحساب البنكي."));
      setAccountIdentifier(""); setRoutingCode("");
      setSuccess(result.message || t("Bank account saved.", "تم حفظ الحساب البنكي."));
      setLoading(true);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to save bank account.", "تعذر حفظ الحساب البنكي."));
    } finally { setSaving(false); }
  }

  async function changeMethod(method: PayoutMethod, action: "default" | "disable") {
    setBusyId(method.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/seller/payout-methods/${encodeURIComponent(method.id)}`, { method: action === "default" ? "PATCH" : "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || t("Unable to update bank account.", "تعذر تحديث الحساب البنكي."));
      setSuccess(action === "default" ? t("Default account updated.", "تم تحديث الحساب الافتراضي.") : t("Bank account removed from your payout methods.", "تمت إزالة الحساب من وسائل استلام الأرباح."));
      setLoading(true);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to update bank account.", "تعذر تحديث الحساب البنكي."));
    } finally { setBusyId(""); }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1120px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[30px] border border-white/90 bg-[linear-gradient(115deg,#fff6ef_0%,#f7e9de_48%,#f2edf5_100%)] p-6 text-[#51433a] shadow-[12px_14px_28px_rgba(119,86,62,.08),inset_0_2px_0_white] sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#9a6548]">{t("SELLER FINANCE", "مالية البائع")}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{t("Bank accounts", "الحسابات البنكية")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#80695b]">{t("Save the bank account where future seller settlements may be sent. Account details are encrypted and only the last four characters are displayed.", "احفظ الحساب البنكي الذي يمكن استخدامه لتحويل مستحقاتك مستقبلاً. تُشفّر بيانات الحساب ولا يظهر منها إلا آخر أربعة أحرف.")}</p>
      </header>

      <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <strong>{t("Transfers are not enabled yet.", "التحويلات غير مفعّلة بعد.")}</strong>{" "}
        {t("Saving a bank account does not create a withdrawable balance or initiate a transfer. Verification, seller ledger, payout approval and bank/provider settlement must be completed first. IBAN is currently supported; local account formats remain disabled until country-specific validation is implemented. Do not enter a payment card number, expiry date or CVV here.", "حفظ الحساب لا ينشئ رصيداً قابلاً للسحب ولا يبدأ تحويلاً. يجب أولاً إكمال التحقق ودفتر مستحقات البائع واعتماد التحويل والتسوية البنكية. ندعم IBAN حالياً؛ أما الحسابات المحلية فستبقى معطلة حتى إضافة تحقق خاص بكل دولة. لا تدخل بيانات بطاقة الدفع هنا.")}
      </section>

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {success && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

      <section className="rounded-[26px] border border-white/90 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-5 shadow-[8px_10px_22px_rgba(119,86,62,.06),inset_0_2px_0_white] sm:p-6">
        <h2 className="text-xl font-black text-[#51433a]">{t("Add a bank account", "إضافة حساب بنكي")}</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-[#526078]">{t("Account format", "نوع الحساب")}
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="rounded-xl border border-white bg-white/90 px-3 py-3 font-medium">
              <option value="IBAN">IBAN</option><option value="LOCAL_BANK_ACCOUNT" disabled>{t("Local bank account (not yet supported)", "الحساب المحلي (غير مدعوم حالياً)")}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#526078]">{t("Account holder name", "اسم صاحب الحساب")}
            <input required minLength={2} maxLength={160} value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} autoComplete="name" className="rounded-xl border border-white bg-white/90 px-3 py-3 font-medium" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#526078]">{t("Bank name", "اسم البنك")}
            <input required minLength={2} maxLength={160} value={bankName} onChange={(event) => setBankName(event.target.value)} className="rounded-xl border border-white bg-white/90 px-3 py-3 font-medium" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#526078]">{t("Country code (ISO)", "رمز الدولة (ISO)")}
            <input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" placeholder="DE" value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} autoComplete="country" className="rounded-xl border border-white bg-white/90 px-3 py-3 font-medium uppercase" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#526078]">{t("Settlement currency", "عملة التسوية")}
            <input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="EUR" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} className="rounded-xl border border-white bg-white/90 px-3 py-3 font-medium uppercase" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#526078] md:col-span-2">{type === "IBAN" ? "IBAN" : t("Bank account number", "رقم الحساب البنكي")}
            <input required minLength={6} maxLength={64} value={accountIdentifier} onChange={(event) => setAccountIdentifier(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} className="rounded-xl border border-white bg-white/90 px-3 py-3 font-mono font-medium tracking-wide" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#526078] md:col-span-2">{t("SWIFT / BIC / routing code (if required)", "رمز SWIFT / BIC / التوجيه (إن لزم)")}
            <input maxLength={34} value={routingCode} onChange={(event) => setRoutingCode(event.target.value.toUpperCase())} autoComplete="off" className="rounded-xl border border-white bg-white/90 px-3 py-3 font-mono font-medium" />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-[#526078] md:col-span-2">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="size-4 accent-[#FF8C1C]" />
            {t("Make this my default bank account", "اجعل هذا الحساب البنكي الافتراضي")}
          </label>
          <div className="md:col-span-2">
            <button disabled={saving} type="submit" className="rounded-2xl bg-[#FF8C1C] px-6 py-3 text-sm font-black text-[#ffffff] shadow-[0_5px_12px_rgba(119,86,62,.09)] disabled:opacity-50">
              {saving ? t("Saving securely…", "جارٍ الحفظ الآمن…") : t("Save bank account", "حفظ الحساب البنكي")}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-[#51433a]">{t("Saved bank accounts", "الحسابات البنكية المحفوظة")}</h2>
        {loading ? <p className="rounded-2xl bg-white/70 p-5 text-sm text-[#80695b]">{t("Loading bank accounts…", "جارٍ تحميل الحسابات البنكية…")}</p>
          : methods.length === 0 ? <p className="rounded-2xl bg-white/70 p-5 text-sm text-[#80695b]">{t("No bank accounts have been added.", "لم تتم إضافة أي حساب بنكي بعد.")}</p>
          : methods.map((method) => <article key={method.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white bg-white/75 p-5 shadow-[6px_8px_18px_rgba(74,75,112,.08),inset_0_1px_0_white]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[#51433a]">{method.bankName}</h3>{method.isDefault && <span className="rounded-full bg-[#e8f4ef] px-2 py-1 text-xs font-bold text-[#356b58]">{t("Default", "افتراضي")}</span>}</div>
              <p className="mt-1 text-sm text-[#687b8b]">{method.accountHolderName} · {method.countryCode} · {method.currencyCode}</p>
              <p className="mt-1 font-mono text-sm text-[#526078]">{method.type === "IBAN" ? "IBAN" : t("Account", "الحساب")} •••• {method.accountLast4}</p>
              <div className="mt-2"><StatusBadge locale={locale} status={method.status} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!method.isDefault && <button type="button" disabled={busyId === method.id} onClick={() => void changeMethod(method, "default")} className="rounded-xl border border-[#eadfd5] px-3 py-2 text-xs font-bold text-[#8a583b] disabled:opacity-50">{t("Make default", "تعيين افتراضي")}</button>}
              <button type="button" disabled={busyId === method.id} onClick={() => { if (window.confirm(t("Remove this bank account?", "هل تريد إزالة هذا الحساب البنكي؟"))) void changeMethod(method, "disable"); }} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">{t("Remove", "إزالة")}</button>
            </div>
          </article>)}
      </section>
    </main>
  );
}
