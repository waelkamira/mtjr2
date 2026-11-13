"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  scopeType: string;
  scopeId: string;
  currencyCode: string;
  isActive: boolean;
  currency: { minorUnit: number };
};
type LedgerLine = {
  id: string;
  lineNumber: number;
  debitMinor: string;
  creditMinor: string;
  memo: string | null;
  journalEntry: {
    id: string;
    sourceType: string;
    sourceId: string;
    description: string;
    currencyCode: string;
    occurredAt: string;
    postedAt: string;
    reversalOfId: string | null;
  };
};
type LedgerResponse = {
  accounts: { items: LedgerAccount[]; nextCursor: string | null };
  activity: {
    account: LedgerAccount;
    totals: { debitMinor: string; creditMinor: string; lineCount: number };
    items: LedgerLine[];
    nextCursor: string | null;
  } | null;
  error?: string;
};

const accountTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
const fieldClass = "min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] shadow-sm outline-none focus:border-[var(--color-orange-500)] focus:ring-2 focus:ring-orange-100";

function minorAmount(value: string, currency: string, minorUnit: number) {
  const amount = BigInt(value);
  const divisor = 10n ** BigInt(minorUnit);
  const whole = amount / divisor;
  const fraction = minorUnit ? (amount % divisor).toString().padStart(minorUnit, "0") : "";
  return `${currency} ${new Intl.NumberFormat().format(whole)}${minorUnit ? `.${fraction}` : ""}`;
}

function dateLabel(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminLedgerPage() {
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [accountType, setAccountType] = useState("");
  const [active, setActive] = useState("all");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [activityCursor, setActivityCursor] = useState("");
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ take: "100", active });
    if (query.trim()) params.set("q", query.trim());
    if (currencyCode.trim()) params.set("currencyCode", currencyCode.trim().toUpperCase());
    if (accountType) params.set("accountType", accountType);
    if (selectedAccountId) params.set("accountId", selectedAccountId);
    if (activityCursor) params.set("activityCursor", activityCursor);
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/admin/finance/ledger?${params.toString()}`, { cache: "no-store" });
        const result = await response.json() as LedgerResponse;
        if (!response.ok) throw new Error(result.error || translate(locale, "The ledger could not be loaded.", "تعذر تحميل دفتر الأستاذ."));
        if (current) {
          setData((previous) => {
            const appendActivity = Boolean(activityCursor && selectedAccountId && previous?.activity?.account.id === selectedAccountId && result.activity);
            return {
              ...result,
              activity: appendActivity && result.activity
                ? { ...result.activity, items: [...(previous?.activity?.items ?? []), ...result.activity.items] }
                : result.activity
            };
          });
          setError("");
          if (!selectedAccountId && result.accounts.items[0]) {
            setActivityCursor("");
            setSelectedAccountId(result.accounts.items[0].id);
          }
          if (selectedAccountId && !result.accounts.items.some((account) => account.id === selectedAccountId)) {
            setActivityCursor("");
            setSelectedAccountId("");
          }
        }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : translate(locale, "The ledger could not be loaded.", "تعذر تحميل دفتر الأستاذ."));
      } finally {
        if (current) setLoading(false);
      }
    });
    return () => { current = false; };
  }, [active, accountType, activityCursor, currencyCode, locale, query, refreshKey, selectedAccountId]);

  const accounts = data?.accounts.items ?? [];
  const activity = data?.activity;

  return (
    <main aria-busy={loading} className="min-h-screen px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Finance · Accounting", "المالية · المحاسبة")}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">{translate(locale, "General ledger", "دفتر الأستاذ العام")}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Read-only view of posted accounts and immutable journal activity.", "عرض للقراءة فقط للحسابات والقيود المحاسبية المنشورة غير القابلة للتعديل.")}</p>
          </div>
          <div className="flex items-center gap-2"><span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">{translate(locale, "Read only", "قراءة فقط")}</span><button type="button" onClick={() => { setError(""); setLoading(true); setRefreshKey((value) => value + 1); }} disabled={loading} className="rounded-xl bg-[#FF8C1C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#E8750B] disabled:cursor-not-allowed disabled:opacity-50">{loading ? translate(locale, "Refreshing…", "جارٍ التحديث…") : translate(locale, "Refresh", "تحديث")}</button></div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          {translate(locale, "This screen does not calculate withdrawable balances or initiate postings, refunds, settlements, or payouts. Account totals are intentionally omitted until the approved accounting and settlement policies define their meaning.", "هذه الشاشة لا تحسب أرصدة قابلة للسحب ولا تنفذ قيوداً أو استردادات أو تسويات أو تحويلات. تم إخفاء إجماليات الحسابات إلى أن تحدد السياسات المحاسبية والتسوية المعتمدة معناها.")}
        </div>

        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{translate(locale, "Account filters", "تصفية الحسابات")}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Search code, name or scope", "بحث بالرمز أو الاسم أو النطاق")}
              <input className={`mt-1 w-full ${fieldClass}`} value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value); }} placeholder={translate(locale, "Search accounts", "ابحث عن حساب")} />
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Currency", "العملة")}
              <input className={`mt-1 w-full ${fieldClass}`} value={currencyCode} maxLength={3} onChange={(event) => { setLoading(true); setCurrencyCode(event.target.value.toUpperCase()); }} placeholder="SYP / USD" />
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Account type", "نوع الحساب")}
              <select className={`mt-1 w-full ${fieldClass}`} value={accountType} onChange={(event) => { setLoading(true); setAccountType(event.target.value); }}>
                <option value="">{translate(locale, "All types", "كل الأنواع")}</option>
                {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Status", "الحالة")}
              <select className={`mt-1 w-full ${fieldClass}`} value={active} onChange={(event) => { setLoading(true); setActive(event.target.value); }}>
                <option value="all">{translate(locale, "All accounts", "كل الحسابات")}</option>
                <option value="true">{translate(locale, "Active", "نشط")}</option>
                <option value="false">{translate(locale, "Inactive", "غير نشط")}</option>
              </select>
            </label>
          </div>
        </section>

        {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
          <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-[var(--foreground)]">{translate(locale, "Chart of accounts", "دليل الحسابات")}</h2>
              <span className="text-xs text-[var(--muted)]">{accounts.length}</span>
            </div>
            {loading && !data ? <p className="py-8 text-center text-sm text-[var(--muted)]">{translate(locale, "Loading accounts…", "جارٍ تحميل الحسابات…")}</p> : null}
            {!loading && accounts.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No ledger accounts match these filters.", "لا توجد حسابات تطابق عوامل التصفية.")}</p> : null}
            <div className="mt-3 space-y-2">
              {accounts.map((account) => {
                const chosen = selectedAccountId === account.id;
                return <button type="button" key={account.id} onClick={() => { setLoading(true); setActivityCursor(""); setSelectedAccountId(account.id); }} className={`w-full rounded-xl border p-3 text-start transition-colors ${chosen ? "border-orange-400 bg-orange-50 shadow-sm" : "border-[var(--border)] bg-[var(--surface)] hover:border-orange-300 hover:bg-orange-50/40"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[var(--color-ink-950)]">{account.code}</span>
                    <StatusBadge locale={locale} status={account.isActive ? "ACTIVE" : "INACTIVE"} />
                  </span>
                  <span className="mt-1 block text-sm text-[var(--color-ink-800)]">{account.name}</span>
                  <span className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]"><span>{account.accountType}</span><span>·</span><span>{account.currencyCode}</span><span>·</span><span>{account.scopeType}: {account.scopeId}</span></span>
                </button>;
              })}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
            <h2 className="font-semibold text-[var(--foreground)]">{translate(locale, "Posted journal activity", "حركة القيود المنشورة")}</h2>
            {activity ? <div className="mt-2 rounded-xl bg-stone-50 p-3">
              <p className="font-semibold text-sm text-[var(--color-ink-950)]">{activity.account.code} · {activity.account.name}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{activity.account.currencyCode} · {activity.account.accountType} · {activity.account.scopeType}: {activity.account.scopeId}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] text-[var(--muted)]">{translate(locale, "Posted debits · all time", "إجمالي المدين المنشور")}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-[var(--foreground)]">{minorAmount(activity.totals.debitMinor, activity.account.currencyCode, activity.account.currency.minorUnit)}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] text-[var(--muted)]">{translate(locale, "Posted credits · all time", "إجمالي الدائن المنشور")}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-[var(--foreground)]">{minorAmount(activity.totals.creditMinor, activity.account.currencyCode, activity.account.currency.minorUnit)}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] text-[var(--muted)]">{translate(locale, "Journal lines", "أسطر القيود")}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-[var(--foreground)]">{activity.totals.lineCount.toLocaleString(locale === "ar" ? "ar" : "en")}</p>
                </div>
              </div>
            </div> : <p className="py-8 text-center text-sm text-[var(--muted)]">{translate(locale, "Select an account to inspect its journal lines.", "اختر حساباً لاستعراض أسطر قيوده.")}</p>}
            {activity && activity.items.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No posted journal lines for this account.", "لا توجد أسطر قيود منشورة لهذا الحساب.")}</p> : null}
            {activity?.items.length ? <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead><tr className="border-b border-[var(--border)] text-xs text-[var(--muted)]"><th className="px-2 py-3 text-start font-medium">{translate(locale, "Journal / date", "القيد / التاريخ")}</th><th className="px-2 py-3 text-start font-medium">{translate(locale, "Description", "الوصف")}</th><th className="px-2 py-3 text-end font-medium">{translate(locale, "Debit", "مدين")}</th><th className="px-2 py-3 text-end font-medium">{translate(locale, "Credit", "دائن")}</th></tr></thead>
                <tbody>{activity.items.map((line) => <tr key={line.id} className="border-b border-stone-100 align-top">
                  <td className="px-2 py-3"><span className="block font-medium text-[var(--color-ink-950)]">{line.journalEntry.id.slice(0, 12)}</span><span className="mt-1 block text-xs text-[var(--muted)]">{dateLabel(line.journalEntry.postedAt, locale)}</span><span className="mt-1 block text-[11px] text-[var(--muted)]">{line.journalEntry.sourceType} · {line.journalEntry.sourceId}</span></td>
                  <td className="px-2 py-3"><span className="block text-[var(--color-ink-900)]">{line.journalEntry.description}</span>{line.memo ? <span className="mt-1 block text-xs text-[var(--muted)]">{line.memo}</span> : null}{line.journalEntry.reversalOfId ? <span className="mt-1 block text-xs text-amber-800">{translate(locale, "Reversal", "قيد عكسي")}</span> : null}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-end tabular-nums text-[var(--color-ink-950)]">{line.debitMinor === "0" ? "—" : minorAmount(line.debitMinor, line.journalEntry.currencyCode, activity.account.currency.minorUnit)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-end tabular-nums text-[var(--color-ink-950)]">{line.creditMinor === "0" ? "—" : minorAmount(line.creditMinor, line.journalEntry.currencyCode, activity.account.currency.minorUnit)}</td>
                </tr>)}</tbody>
              </table>
            </div> : null}
            {activity?.nextCursor ? <div className="mt-4 flex justify-center"><button type="button" onClick={() => { setLoading(true); setActivityCursor(activity.nextCursor || ""); }} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink-900)] transition hover:border-orange-300 hover:bg-orange-50">{translate(locale, "Load older entries", "تحميل القيود الأقدم")}</button></div> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
