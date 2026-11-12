"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type PolicyVersion = {
  id: string;
  version: number;
  approvalStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  classification: "LEGAL" | "CONTRACTUAL" | "PLATFORM";
  countryCode: string | null;
  subdivisionCode: string | null;
  marketCode: string | null;
  currencyCode: string | null;
  productClass: string | null;
  paymentProvider: string | null;
  sellerId: string | null;
  categoryId: string | null;
  priority: number;
  value: unknown;
  effectiveFrom: string;
  effectiveUntil: string | null;
  sourceReference: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  rule: { key: string; domain: string; description: string | null };
};

const inputClass = "mt-1 block w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink-950)] shadow-sm outline-none focus:border-[var(--color-orange-500)] focus:ring-2 focus:ring-orange-100";
const labelClass = "block text-sm font-medium text-[var(--color-ink-800)]";

function localDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function statusLabel(status: PolicyVersion["approvalStatus"], locale: string) {
  if (status === "APPROVED") return translate(locale, "Approved", "معتمد");
  if (status === "REJECTED") return translate(locale, "Rejected", "مرفوض");
  return translate(locale, "Pending review", "بانتظار المراجعة");
}

export default function FinancialPoliciesPage() {
  const { locale } = useLocale();
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [key, setKey] = useState("");
  const [domain, setDomain] = useState("SELLER_PAYOUT");
  const [classification, setClassification] = useState<"LEGAL" | "CONTRACTUAL" | "PLATFORM">("PLATFORM");
  const [description, setDescription] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [subdivisionCode, setSubdivisionCode] = useState("");
  const [marketCode, setMarketCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [productClass, setProductClass] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("");
  const [priority, setPriority] = useState("0");
  const [valueJson, setValueJson] = useState('{"enabled": true}');
  const [effectiveFrom, setEffectiveFrom] = useState(() => localDateTimeValue(new Date()));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("approvalStatus", statusFilter);
    if (domainFilter.trim()) params.set("domain", domainFilter.trim().toUpperCase());
    params.set("limit", "50");
    const response = await fetch(`/api/admin/financial-policies?${params.toString()}`, { cache: "no-store" });
    const data = await response.json() as { versions?: PolicyVersion[]; error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Financial policies could not be loaded.", "تعذر تحميل السياسات المالية."));
    setVersions(data.versions || []);
  }, [domainFilter, locale, statusFilter]);

  useEffect(() => {
    let active = true;
    void load().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load financial policies.", "تعذر تحميل السياسات المالية."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, locale]);

  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      let value: unknown;
      try { value = JSON.parse(valueJson); } catch { throw new Error(translate(locale, "Policy value must be valid JSON.", "يجب أن تكون قيمة السياسة بصيغة JSON صحيحة.")); }
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(translate(locale, "Policy value must be a JSON object.", "يجب أن تكون قيمة السياسة كائناً بصيغة JSON."));
      const response = await fetch("/api/admin/financial-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim().toUpperCase(),
          domain: domain.trim().toUpperCase(),
          description: description.trim() || null,
          classification,
          countryCode: countryCode.trim() || null,
          subdivisionCode: subdivisionCode.trim() || null,
          marketCode: marketCode.trim() || null,
          currencyCode: currencyCode.trim() || null,
          productClass: productClass.trim() || null,
          paymentProvider: paymentProvider.trim() || null,
          priority: Number(priority),
          value,
          effectiveFrom: new Date(effectiveFrom).toISOString(),
          effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
          sourceReference: sourceReference.trim() || null,
          reviewNotes: reviewNotes.trim() || null
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Policy version could not be created.", "تعذر إنشاء إصدار السياسة."));
      toast.success(translate(locale, "Policy version created as pending review.", "تم إنشاء إصدار السياسة بانتظار المراجعة."));
      setKey(""); setDescription(""); setValueJson('{"enabled": true}');
      setCountryCode(""); setSubdivisionCode(""); setMarketCode(""); setCurrencyCode("");
      setProductClass(""); setPaymentProvider(""); setSourceReference(""); setReviewNotes("");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Policy version could not be created.", "تعذر إنشاء إصدار السياسة.");
      setError(message); toast.error(message);
    } finally { setBusy(""); }
  }

  async function transition(version: PolicyVersion, action: "REVIEW" | "APPROVE" | "REJECT") {
    const prompt = action === "REJECT"
      ? translate(locale, "Enter the rejection reason (at least 5 characters):", "أدخل سبب الرفض (5 أحرف على الأقل):")
      : action === "REVIEW"
        ? translate(locale, "Review notes (optional):", "ملاحظات المراجعة (اختياري):")
        : translate(locale, "Approval notes (optional):", "ملاحظات الاعتماد (اختياري):");
    const notes = window.prompt(prompt, action === "REJECT" ? "" : (version.reviewNotes || ""));
    if (notes === null || (action === "REJECT" && notes.trim().length < 5)) return;
    setBusy(version.id); setError("");
    try {
      const response = await fetch(`/api/admin/financial-policies/${encodeURIComponent(version.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(notes.trim() ? { notes: notes.trim() } : {}) })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Policy transition failed.", "تعذر تحديث حالة السياسة."));
      toast.success(action === "APPROVE"
        ? translate(locale, "Policy version approved.", "تم اعتماد إصدار السياسة.")
        : action === "REVIEW"
          ? translate(locale, "Policy version reviewed.", "تمت مراجعة إصدار السياسة.")
          : translate(locale, "Policy version rejected.", "تم رفض إصدار السياسة."));
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Policy transition failed.", "تعذر تحديث حالة السياسة.");
      setError(message); toast.error(message);
    } finally { setBusy(""); }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="mb-7">
        <p className="text-sm font-semibold text-[var(--color-orange-600)]">{translate(locale, "Platform finance", "الشؤون المالية للمنصة")}</p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--color-ink-950)]">{translate(locale, "Financial policy governance", "حوكمة السياسات المالية")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {translate(locale, "Create versioned rules for jurisdiction, market, currency, product and payment contexts. Every new version starts pending review. Approval does not activate money movement.", "أنشئ قواعد ذات إصدارات حسب الدولة والسوق والعملة والمنتج ووسيلة الدفع. يبدأ كل إصدار جديد بانتظار المراجعة. الاعتماد لا يفعّل حركة الأموال.")}
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: translate(locale, "Pending review", "بانتظار المراجعة"), count: versions.filter((item) => item.approvalStatus === "PENDING_REVIEW").length },
          { label: translate(locale, "Approved", "معتمد"), count: versions.filter((item) => item.approvalStatus === "APPROVED").length },
          { label: translate(locale, "Rejected", "مرفوض"), count: versions.filter((item) => item.approvalStatus === "REJECTED").length }
        ].map((item) => <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-clay-raised"><p className="text-sm text-[var(--muted)]">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink-950)]">{item.count}</p></div>)}
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-clay-raised sm:p-6">
        <h2 className="text-xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Create a policy version", "إنشاء إصدار سياسة")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Policy content is immutable after creation. To change its meaning, create a new version using the same key.", "محتوى السياسة غير قابل للتعديل بعد الإنشاء. لتغيير معناها، أنشئ إصداراً جديداً باستخدام المفتاح نفسه.")}</p>
        <form onSubmit={createVersion} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>{translate(locale, "Policy key", "مفتاح السياسة")}<input className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} required minLength={3} maxLength={120} placeholder="SELLER_PAYOUT.HOLD_DAYS"/></label>
          <label className={labelClass}>{translate(locale, "Domain", "المجال")}<input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} required maxLength={64} placeholder="SELLER_PAYOUT"/></label>
          <label className={labelClass}>{translate(locale, "Classification", "التصنيف")}<select className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value as typeof classification)}><option value="PLATFORM">PLATFORM</option><option value="CONTRACTUAL">CONTRACTUAL</option><option value="LEGAL">LEGAL</option></select></label>
          <label className={labelClass}>{translate(locale, "Description", "الوصف")}<input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}/></label>
          <label className={labelClass}>{translate(locale, "Country code", "رمز الدولة")}<input className={inputClass} value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} placeholder="SY"/></label>
          <label className={labelClass}>{translate(locale, "Region / subdivision", "المنطقة / التقسيم")}<input className={inputClass} value={subdivisionCode} onChange={(e) => setSubdivisionCode(e.target.value.toUpperCase())} maxLength={32}/></label>
          <label className={labelClass}>{translate(locale, "Market code", "رمز السوق")}<input className={inputClass} value={marketCode} onChange={(e) => setMarketCode(e.target.value.toUpperCase())} maxLength={32}/></label>
          <label className={labelClass}>{translate(locale, "Currency code", "رمز العملة")}<input className={inputClass} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} placeholder="USD"/></label>
          <label className={labelClass}>{translate(locale, "Product class", "فئة المنتج")}<input className={inputClass} value={productClass} onChange={(e) => setProductClass(e.target.value.toUpperCase())} maxLength={80}/></label>
          <label className={labelClass}>{translate(locale, "Payment provider", "مزود الدفع")}<input className={inputClass} value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value.toUpperCase())} maxLength={80}/></label>
          <label className={labelClass}>{translate(locale, "Priority", "الأولوية")}<input className={inputClass} type="number" value={priority} onChange={(e) => setPriority(e.target.value)} min={-100000} max={100000}/></label>
          <label className={labelClass}>{translate(locale, "Effective from", "ساري من")}<input className={inputClass} type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required/></label>
          <label className={labelClass}>{translate(locale, "Effective until", "ساري حتى")}<input className={inputClass} type="datetime-local" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)}/></label>
          <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>{translate(locale, "Source reference URL (required for legal rules)", "رابط المصدر (مطلوب للقواعد القانونية)")}<input className={inputClass} type="url" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="https://..."/></label>
          <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>{translate(locale, "Value (JSON object)", "القيمة (كائن JSON)")}<textarea className={`${inputClass} min-h-28 font-mono`} value={valueJson} onChange={(e) => setValueJson(e.target.value)} required spellCheck={false}/></label>
          <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>{translate(locale, "Review notes (required for legal rules)", "ملاحظات المراجعة (مطلوبة للقواعد القانونية)")}<textarea className={`${inputClass} min-h-20`} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} maxLength={2000}/></label>
          <div className="sm:col-span-2 lg:col-span-3"><button type="submit" disabled={busy !== ""} className="rounded-xl bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E8750B] disabled:cursor-not-allowed disabled:opacity-50">{busy === "create" ? translate(locale, "Creating…", "جارٍ الإنشاء…") : translate(locale, "Create pending version", "إنشاء إصدار بانتظار المراجعة")}</button></div>
        </form>
      </section>

      <section className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-clay-raised sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Policy versions", "إصدارات السياسات")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{translate(locale, "Review the scope, evidence and approval history of each version.", "راجع النطاق والأدلة وسجل اعتماد كل إصدار.")}</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={labelClass}>{translate(locale, "Status", "الحالة")}<select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">{translate(locale, "All statuses", "كل الحالات")}</option><option value="PENDING_REVIEW">PENDING_REVIEW</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></label>
            <label className={labelClass}>{translate(locale, "Domain filter", "تصفية المجال")}<input className={inputClass} value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} placeholder="SELLER_PAYOUT"/></label>
          </div>
        </div>
        {loading ? <p className="py-8 text-sm text-[var(--muted)]">{translate(locale, "Loading policy versions…", "جارٍ تحميل إصدارات السياسات…")}</p> : versions.length === 0 ? <p className="py-8 text-sm text-[var(--muted)]">{translate(locale, "No policy versions match these filters.", "لا توجد إصدارات مطابقة لعوامل التصفية.")}</p> : (
          <div className="mt-5 space-y-3">
            {versions.map((version) => <article key={version.id} className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="break-all font-semibold text-[var(--color-ink-950)]">{version.rule.key} <span className="text-[var(--muted)]">v{version.version}</span></h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${version.approvalStatus === "APPROVED" ? "bg-emerald-100 text-emerald-800" : version.approvalStatus === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{statusLabel(version.approvalStatus, locale)}</span></div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{version.rule.domain} · {version.classification} · {version.rule.description || translate(locale, "No description", "لا يوجد وصف")}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{[version.countryCode, version.subdivisionCode, version.marketCode, version.currencyCode, version.productClass, version.paymentProvider, version.sellerId ? "SELLER" : null, version.categoryId ? "CATEGORY" : null].filter(Boolean).join(" / ") || translate(locale, "Global scope", "نطاق عام")} · {translate(locale, "Priority", "الأولوية")}: {version.priority}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{new Date(version.effectiveFrom).toLocaleString()} – {version.effectiveUntil ? new Date(version.effectiveUntil).toLocaleString() : translate(locale, "No end date", "بلا تاريخ انتهاء")}</p>
                  <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-[var(--color-ink-800)]">{translate(locale, "View policy value and evidence", "عرض قيمة السياسة والأدلة")}</summary><pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-stone-50 p-3 text-xs text-stone-800">{JSON.stringify(version.value, null, 2)}</pre>{version.sourceReference && <a className="mt-2 inline-block break-all text-sm text-orange-700 underline" href={version.sourceReference} target="_blank" rel="noreferrer">{version.sourceReference}</a>}{version.reviewNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">{version.reviewNotes}</p>}{version.rejectionReason && <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">{version.rejectionReason}</p>}</details>
                </div>
                {version.approvalStatus === "PENDING_REVIEW" && <div className="flex shrink-0 flex-wrap gap-2">
                  {!version.reviewedAt && <button type="button" disabled={busy !== ""} onClick={() => void transition(version, "REVIEW")} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-ink-900)] hover:border-orange-300 disabled:opacity-50">{translate(locale, "Review", "مراجعة")}</button>}
                  <button type="button" disabled={busy !== ""} onClick={() => void transition(version, "APPROVE")} className="rounded-lg bg-[#FF8C1C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#E8750B] disabled:opacity-50">{translate(locale, "Approve", "اعتماد")}</button>
                  <button type="button" disabled={busy !== ""} onClick={() => void transition(version, "REJECT")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{translate(locale, "Reject", "رفض")}</button>
                </div>}
              </div>
            </article>)}
          </div>
        )}
      </section>
    </main>
  );
}
