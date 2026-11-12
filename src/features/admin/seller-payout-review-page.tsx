"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type PayoutMethod = {
  id: string;
  sellerId: string;
  type: "IBAN" | "LOCAL_BANK_ACCOUNT";
  bankName: string;
  countryCode: string;
  currencyCode: string;
  accountLast4: string;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  isDefault: boolean;
  verifiedAt: string | null;
  createdAt: string;
  submittedAt: string;
  submissionVersion: number;
  seller: {
    displayName: string | null;
    legalName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    owner: { id: string; email: string; displayName: string | null };
  };
};
type Listing = { items: PayoutMethod[]; page: number; pageCount: number; total: number };
type Draft = { evidenceReference: string; reason: string };
const emptyDraft: Draft = { evidenceReference: "", reason: "" };

export default function SellerPayoutReviewPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const t = useCallback((en: string, ar: string) => translate(locale, en, ar), [locale]);
  const [status, setStatus] = useState("PENDING_VERIFICATION");
  const [page, setPage] = useState(1);
  const statusRef = useRef(status);
  const pageRef = useRef(page);
  const [data, setData] = useState<Listing | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{ id: string; decision: "VERIFIED" | "REJECTED" } | null>(null);
  const [error, setError] = useState("");
  const loadRequestId = useRef(0);
  const draftsRef = useRef<Record<string, Draft>>({});
  const draftStorageKey = "seller-payout-review-draft";

  const redirectForStepUp = useCallback(() => {
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draftsRef.current));
    } catch {
      // Continue to MFA even when browser storage is unavailable.
    }
    router.replace("/mfa/verify?returnTo=%2Fadmin%2Fseller-payout-methods");
  }, [router]);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    try {
      const stored = window.sessionStorage.getItem(draftStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Draft>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          draftsRef.current = parsed;
          timer = window.setTimeout(() => {
            if (!cancelled) setDrafts(parsed);
          }, 0);
        }
        window.sessionStorage.removeItem(draftStorageKey);
      }
    } catch {
      try { window.sessionStorage.removeItem(draftStorageKey); } catch { /* Ignore unavailable storage. */ }
    }
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const load = useCallback(async (requestedStatus: string, requestedPage: number) => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: requestedStatus, page: String(requestedPage) });
      const response = await fetch("/api/admin/seller-payout-methods?" + params, { cache: "no-store" });
      if (requestId !== loadRequestId.current) return;
      if (response.status === 428) {
        redirectForStepUp();
        return;
      }
      const result = await response.json() as Listing & { error?: string };
      if (requestId !== loadRequestId.current) return;
      if (!response.ok) throw new Error(result.error || t("Unable to load bank destinations.", "تعذر تحميل الحسابات البنكية."));
      if (requestedPage > result.pageCount) {
        const lastPage = Math.max(1, result.pageCount);
        pageRef.current = lastPage;
        setPage(lastPage);
        return;
      }
      setData(result);
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      setError(cause instanceof Error ? cause.message : t("Unable to load bank destinations.", "تعذر تحميل الحسابات البنكية."));
      setData(null);
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [t, redirectForStepUp]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(status, page); }, 0);
    return () => {
      window.clearTimeout(timer);
      loadRequestId.current += 1;
    };
  }, [load, status, page]);

  function draftKey(item: Pick<PayoutMethod, "id" | "submissionVersion">) {
    return `${item.id}:${item.submissionVersion}`;
  }

  function updateDraft(item: PayoutMethod, key: keyof Draft, value: string) {
    const keyForSubmission = draftKey(item);
    setDrafts((current) => {
      const next = { ...current, [keyForSubmission]: { ...(current[keyForSubmission] ?? emptyDraft), [key]: value } };
      draftsRef.current = next;
      return next;
    });
  }

  async function review(item: PayoutMethod, decision: "VERIFIED" | "REJECTED") {
    const keyForSubmission = draftKey(item);
    const draft = drafts[keyForSubmission] ?? emptyDraft;
    const evidenceReference = draft.evidenceReference.trim();
    const reason = draft.reason.trim();
    if (evidenceReference.length < 6 || reason.length < 10) {
      const message = t("Enter an evidence reference (at least 6 characters) and a reason (at least 10 characters).", "أدخل مرجع إثبات لا يقل عن 6 أحرف وسبباً لا يقل عن 10 أحرف.");
      setError(message); toast.error(message); return;
    }
    if (!window.confirm(t(decision === "VERIFIED" ? "Confirm that the bank account was independently verified outside this platform?" : "Confirm rejection of this bank account?", decision === "VERIFIED" ? "هل تؤكد التحقق المستقل من الحساب البنكي عبر جهة خارج المنصة؟" : "هل تؤكد رفض هذا الحساب البنكي؟"))) return;
    setBusy({ id: item.id, decision }); setError("");
    try {
      const response = await fetch("/api/admin/seller-payout-methods/" + encodeURIComponent(item.id) + "/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, evidenceReference, reason, expectedSubmissionVersion: item.submissionVersion }),
        cache: "no-store"
      });
      if (response.status === 428) {
        redirectForStepUp();
        return;
      }
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || t("Bank account review failed.", "تعذرت مراجعة الحساب البنكي."));
      setDrafts((current) => {
        const next = { ...current, [keyForSubmission]: emptyDraft };
        draftsRef.current = next;
        return next;
      });
      toast.success(t("Bank account review saved and audited.", "تم حفظ مراجعة الحساب البنكي وتسجيلها في سجل التدقيق."));
      await load(statusRef.current, pageRef.current);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Bank account review failed.", "تعذرت مراجعة الحساب البنكي.");
      setError(message); toast.error(message);
    } finally { setBusy(null); }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)]";
  return <main className="min-h-screen bg-[#f5f6f8] px-4 py-6 sm:px-6 lg:px-9"><div className="mx-auto max-w-[1600px]">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{t("Platform finance controls", "ضوابط مالية المنصة")}</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("Seller bank verification", "التحقق من الحسابات البنكية للبائعين")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{t("Review masked payout destinations after independently checking account ownership with the bank or approved provider. Every decision requires evidence and a reason.", "راجع بيانات الحسابات المقنّعة بعد التحقق المستقل من الملكية لدى البنك أو مزود معتمد. يتطلب كل قرار مرجع إثبات وسبباً موثقاً.")}</p></div><button type="button" onClick={() => void load(statusRef.current, pageRef.current)} disabled={loading} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{t("Refresh", "تحديث")}</button></div>
    <div className="mt-6 flex flex-wrap gap-2">{[["PENDING_VERIFICATION", t("Pending review", "بانتظار المراجعة")], ["VERIFIED", t("Verified", "تم التحقق")], ["REJECTED", t("Rejected", "مرفوض")]].map(([value, label]) => <button key={value} type="button" onClick={() => { statusRef.current = value; pageRef.current = 1; setStatus(value); setPage(1); }} className={status === value ? "rounded-full bg-[var(--color-forest-900)] px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"}>{label}</button>)}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : <div className="mt-5 space-y-4">
      {!data?.items.length ? <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center text-sm text-[var(--muted)]">{t("No bank destinations in this status.", "لا توجد حسابات بنكية بهذه الحالة.")}</div> : data.items.map((item) => {
        const draft = drafts[item.id] ?? emptyDraft;
        const sellerName = item.seller.displayName || item.seller.legalName || item.seller.contactName || t("Unnamed seller", "بائع بلا اسم");
        return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--muted)]">{t("Seller", "البائع")} · {item.sellerId}</p><h2 className="mt-1 text-lg font-semibold text-[var(--color-forest-950)]">{sellerName}</h2><p className="mt-1 text-sm text-[var(--muted)]">{item.seller.owner.displayName || item.seller.owner.email} · {item.seller.owner.email}</p></div><StatusBadge locale={locale} status={item.status} /></div>
          <div className="mt-4 grid gap-3 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-[var(--muted)]">{t("Bank", "البنك")}</p><p className="mt-1 font-semibold">{item.bankName}</p></div>
            <div><p className="text-xs text-[var(--muted)]">{t("Account type", "نوع الحساب")}</p><p className="mt-1 font-semibold">{item.type}</p></div>
            <div><p className="text-xs text-[var(--muted)]">{t("Masked identifier", "المعرّف المقنّع")}</p><p className="mt-1 font-semibold" dir="ltr">•••• {item.accountLast4}</p></div>
            <div><p className="text-xs text-[var(--muted)]">{t("Country / currency", "الدولة / العملة")}</p><p className="mt-1 font-semibold">{item.countryCode} / {item.currencyCode}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]"><span>{t("Submitted", "تاريخ الإضافة")}: {new Date(item.submittedAt).toLocaleString(locale)}</span><span>{item.isDefault ? t("Default for this currency", "افتراضي لهذه العملة") : t("Not default", "ليس افتراضياً")}</span></div>
          {item.status === "PENDING_VERIFICATION" && <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label className="text-xs font-semibold text-[var(--muted)]">{t("External evidence reference", "مرجع الإثبات الخارجي")}<input value={draft.evidenceReference} onChange={(event) => updateDraft(item, "evidenceReference", event.target.value)} maxLength={180} className={inputClass} placeholder={t("Bank case / verification ticket", "رقم حالة البنك / تذكرة التحقق")} /></label>
            <label className="text-xs font-semibold text-[var(--muted)]">{t("Review reason", "سبب المراجعة")}<textarea value={draft.reason} onChange={(event) => updateDraft(item, "reason", event.target.value)} minLength={10} maxLength={500} rows={2} className={inputClass} placeholder={t("Record what was checked and the outcome", "سجّل ما تم التحقق منه والنتيجة")} /></label>
            <div className="flex flex-wrap gap-2 lg:col-span-2"><button type="button" disabled={Boolean(busy)} onClick={() => void review(item, "VERIFIED")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?.id === item.id && busy.decision === "VERIFIED" ? t("Saving…", "جارٍ الحفظ…") : t("Confirm verified", "تأكيد التحقق")}</button><button type="button" disabled={Boolean(busy)} onClick={() => void review(item, "REJECTED")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50">{busy?.id === item.id && busy.decision === "REJECTED" ? t("Saving…", "جارٍ الحفظ…") : t("Reject account", "رفض الحساب")}</button></div>
          </div>}
          {item.status !== "PENDING_VERIFICATION" && item.verifiedAt && <p className="mt-4 text-xs text-[var(--muted)]">{t("Verified at", "تاريخ التحقق")}: {new Date(item.verifiedAt).toLocaleString(locale)}</p>}
        </article>;
      })}
    </div>}
    {data && (data.pageCount > 1 || page > 1) && <div className="mt-5 flex items-center justify-between"><p className="text-sm text-[var(--muted)]">{t("Page", "صفحة")} {data.page} / {data.pageCount} · {data.total} {t("records", "سجل")}</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => { const nextPage = Math.max(1, pageRef.current - 1); pageRef.current = nextPage; setPage(nextPage); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40">{t("Previous", "السابق")}</button><button type="button" disabled={page >= data.pageCount || loading} onClick={() => { const nextPage = pageRef.current + 1; pageRef.current = nextPage; setPage(nextPage); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40">{t("Next", "التالي")}</button></div></div>}
    <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{t("Important: this screen records a human administrator's attestation only. It does not contact banks, independently verify ownership, or initiate seller transfers. Never approve without completing the external check.", "تنبيه: تسجل هذه الصفحة إقراراً من مسؤول بشري فقط. لا تتصل بالبنوك ولا تتحقق آلياً من الملكية ولا تنفذ تحويلات للبائعين. لا توافق قبل إتمام التحقق الخارجي.")}</p>
  </div></main>;
}
