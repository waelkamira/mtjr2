"use client";

import { StatusBadge } from "@/components/status-badge";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Provider = {
  id: string;
  providerKey: "stripe" | "paypal";
  displayName: string;
  environment: "TEST" | "LIVE";
  status: "DRAFT" | "CONFIGURED" | "ACTIVE" | "DISABLED" | "ARCHIVED";
  credentialsConfigured: boolean;
  credentialFingerprint: string | null;
  supportedCountries: string[];
  supportedCurrencies: string[];
  enabledPaymentMethods: string[];
  sortOrder: number;
  lastVerifiedAt: string | null;
  lastVerificationStatus: string | null;
  lastVerificationMessage: string | null;
  archivedAt: string | null;
};

const emptyDraft = {
  providerKey: "paypal" as "stripe" | "paypal",
  environment: "TEST" as "TEST" | "LIVE",
  displayName: "PayPal",
  secretKey: "",
  webhookSecret: "",
  clientId: "",
  clientSecret: "",
  webhookId: "",
  countries: "",
  currencies: "",
  methods: "",
  sortOrder: 0
};

export default function PaymentProvidersPage() {
  const { locale } = useLocale();
  const t = useCallback((en: string, ar: string) => translate(locale, en, ar), [locale]);
  const [items, setItems] = useState<Provider[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState({ displayName: "", countries: "", currencies: "", methods: "", sortOrder: 0, secretA: "", secretB: "", webhookId: "" });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/payment-providers", { cache: "no-store" });
      const data = await response.json() as { items?: Provider[]; error?: string };
      if (!response.ok) throw new Error(data.error || t("Unable to load provider configurations.", "تعذر تحميل إعدادات مزودي الدفع."));
      setItems(data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to load provider configurations.", "تعذر تحميل إعدادات مزودي الدفع."));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mutate(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store"
    });
    const data = await response.json() as { item?: Provider; error?: string };
    if (!response.ok) throw new Error(data.error || t("The operation could not be completed.", "تعذر تنفيذ العملية."));
    if (data.item) setItems((current) => {
      const found = current.some((item) => item.id === data.item!.id);
      return found ? current.map((item) => item.id === data.item!.id ? data.item! : item) : [...current, data.item!];
    });
    return data.item;
  }

  async function create() {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const credentials = draft.providerKey === "paypal"
        ? { clientId: draft.clientId, clientSecret: draft.clientSecret, webhookId: draft.webhookId }
        : { secretKey: draft.secretKey, webhookSecret: draft.webhookSecret };
      const item = await mutate("/api/admin/payment-providers", "POST", {
        providerKey: draft.providerKey,
        environment: draft.environment,
        displayName: draft.displayName,
        credentials,
        supportedCountries: draft.countries.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
        supportedCurrencies: draft.currencies.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
        enabledPaymentMethods: draft.methods.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
        sortOrder: draft.sortOrder
      });
      if (item) setItems((current) => current.some((x) => x.id === item.id) ? current : [...current, item]);
      setDraft(emptyDraft); setShowForm(false);
      toast.success(t("Provider configuration saved.", "تم حفظ إعدادات مزود الدفع."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Unable to save provider.", "تعذر حفظ مزود الدفع.");
      setError(message); toast.error(message);
    } finally { setSaving(false); }
  }

  function beginEdit(item: Provider) {
    setEditingId(item.id);
    setEditDraft({
      displayName: item.displayName,
      countries: item.supportedCountries.join(", "),
      currencies: item.supportedCurrencies.join(", "),
      methods: item.enabledPaymentMethods.join(", "),
      sortOrder: item.sortOrder,
      secretA: "", secretB: "", webhookId: ""
    });
  }

  async function saveEdit(item: Provider) {
    setBusyId(item.id); setError("");
    try {
      const body: Record<string, unknown> = {
        displayName: editDraft.displayName,
        supportedCountries: editDraft.countries.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
        supportedCurrencies: editDraft.currencies.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
        enabledPaymentMethods: editDraft.methods.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
        sortOrder: editDraft.sortOrder
      };
      const hasCredentialChange = Boolean(editDraft.secretA || editDraft.secretB || editDraft.webhookId);
      if (hasCredentialChange) {
        body.credentials = item.providerKey === "paypal"
          ? { clientId: editDraft.secretA, clientSecret: editDraft.secretB, webhookId: editDraft.webhookId }
          : { secretKey: editDraft.secretA, webhookSecret: editDraft.secretB };
      }
      await mutate("/api/admin/payment-providers/" + encodeURIComponent(item.id), "PATCH", body);
      setEditingId("");
      toast.success(t("Provider configuration updated.", "تم تحديث إعدادات مزود الدفع."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Unable to update provider.", "تعذر تحديث مزود الدفع.");
      setError(message); toast.error(message);
    } finally { setBusyId(""); }
  }

  const [rotationBusy, setRotationBusy] = useState(false);
  const [rotationReport, setRotationReport] = useState<{
    activeKeyVersion: number; providerConfigsReencrypted: number;
    paymentSnapshotsReencrypted: number; remainingProviderConfigs: number;
    remainingPaymentSnapshots: number; complete: boolean;
  } | null>(null);

  async function rotateCredentials() {
    if (rotationBusy) return;
    const confirmed = window.confirm(t(
      "Re-encrypt all stored provider credentials and historical payment snapshots using the active key version? Keep all previous keys in the key ring until the report confirms zero remaining records.",
      "هل تريد إعادة تشفير جميع بيانات مزودي الدفع ونسخ المدفوعات التاريخية بالمفتاح النشط؟ احتفظ بجميع المفاتيح السابقة حتى يؤكد التقرير عدم بقاء أي سجلات."
    ));
    if (!confirmed) return;
    setRotationBusy(true);
    setRotationReport(null);
    try {
      const response = await fetch("/api/admin/payment-providers/rotate-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store"
      });
      const data = await response.json() as {
        result?: NonNullable<typeof rotationReport>;
        error?: string;
      };
      if (!response.ok || !data.result) throw new Error(data.error || t("Credential re-encryption failed.", "فشلت إعادة تشفير بيانات الاعتماد."));
      setRotationReport(data.result);
      if (data.result.complete) {
        toast.success(t("All stored payment credentials were re-encrypted.", "تمت إعادة تشفير جميع بيانات الدفع."));
      } else {
        toast.warning(t("Some records still use previous keys. Keep the old keys and run rotation again.", "لا تزال بعض السجلات تستخدم مفاتيح سابقة. احتفظ بالمفاتيح القديمة وأعد التدوير."));
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Credential re-encryption failed.", "فشلت إعادة تشفير بيانات الاعتماد.");
      setError(message);
      toast.error(message);
    } finally {
      setRotationBusy(false);
    }
  }

  async function action(id: string, actionName: "verify" | "enable" | "disable" | "archive") {
    if (busyId) return;
    if (actionName === "archive" && window.prompt(t("Type ARCHIVE to confirm. The record and credentials will be retained for historical payment verification.", "اكتب ARCHIVE للتأكيد. سيُحتفظ بالسجل وبيانات التحقق للمدفوعات التاريخية.")) !== "ARCHIVE") return;
    setBusyId(id); setError("");
    try {
      const method = actionName === "archive" ? "DELETE" : "POST";
      const item = await mutate("/api/admin/payment-providers/" + encodeURIComponent(id) + (actionName === "archive" ? "" : "/" + actionName), method);
      if (item) toast.success(t("Provider updated.", "تم تحديث مزود الدفع."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Unable to update provider.", "تعذر تحديث مزود الدفع.");
      setError(message); toast.error(message);
    } finally { setBusyId(""); }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)]";
  const visibleItems = items.filter((item) => item.status !== "ARCHIVED");

  return (
    <main aria-busy={loading || saving || busyId !== "" || rotationBusy} dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto min-h-screen w-full max-w-[1600px] bg-[var(--background)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#d97706]">{t("Platform finance", "مالية المنصة")}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{t("Payment providers", "مزودو الدفع")}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{t("Configure supported payment adapters, verify credentials, manage test/live records and archive safely. Secrets are encrypted at rest and never returned to this page.", "أضف إعدادات بوابات الدفع المدعومة وتحقق من بياناتها وأدر بيئتي الاختبار والإنتاج وأرشفها بأمان. تُشفّر الأسرار في قاعدة البيانات ولا تُعاد إلى هذه الصفحة.")}</p>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setLoading(true); setError(""); void load(); }} disabled={loading || saving || Boolean(busyId)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50">{loading ? t("Refreshing…", "جارٍ التحديث…") : t("Refresh", "تحديث")}</button><button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white">{showForm ? t("Close form", "إغلاق النموذج") : t("Add provider", "إضافة مزود دفع")}</button></div>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--foreground)]">
          {t("Active database configurations now drive new checkout sessions for their selected TEST/LIVE environment, supported countries and currencies. Each payment retains an encrypted credential snapshot so later credential rotation or provider disablement does not break verification of its existing webhook events.", "تتحكم الإعدادات النشطة المخزنة في قاعدة البيانات الآن بعمليات الدفع الجديدة وفق بيئة TEST/LIVE والدول والعملات المدعومة. يحتفظ كل دفع بنسخة مشفرة من بيانات الاعتماد حتى لا يؤدي تدوير المفاتيح أو تعطيل المزود إلى تعطيل التحقق من إشعارات المدفوعات القائمة.")}
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

        {showForm && <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-ink-950)]">{t("New provider configuration", "إعداد مزود دفع جديد")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium">{t("Provider", "المزود")}
              <select className={inputClass} value={draft.providerKey} onChange={(e) => setDraft((x) => ({ ...x, providerKey: e.target.value as "stripe" | "paypal", displayName: e.target.value === "paypal" ? "PayPal" : "Stripe" }))}>
                <option value="paypal">PayPal</option><option value="stripe">Stripe</option>
              </select>
            </label>
            <label className="text-sm font-medium">{t("Environment", "البيئة")}
              <select className={inputClass} value={draft.environment} onChange={(e) => setDraft((x) => ({ ...x, environment: e.target.value as "TEST" | "LIVE" }))}>
                <option value="TEST">{t("Test / Sandbox", "اختبار / Sandbox")}</option><option value="LIVE">{t("Live / Production", "فعلي / إنتاج")}</option>
              </select>
            </label>
            <label className="text-sm font-medium">{t("Display name", "الاسم الظاهر")}<input className={inputClass} value={draft.displayName} maxLength={120} onChange={(e) => setDraft((x) => ({ ...x, displayName: e.target.value }))} /></label>
            {draft.providerKey === "paypal" ? <>
              <label className="text-sm font-medium">PayPal Client ID<input autoComplete="off" className={inputClass} value={draft.clientId} onChange={(e) => setDraft((x) => ({ ...x, clientId: e.target.value }))} /></label>
              <label className="text-sm font-medium">PayPal Client Secret<input type="password" autoComplete="new-password" className={inputClass} value={draft.clientSecret} onChange={(e) => setDraft((x) => ({ ...x, clientSecret: e.target.value }))} /></label>
              <label className="text-sm font-medium">PayPal Webhook ID<input autoComplete="off" className={inputClass} value={draft.webhookId} onChange={(e) => setDraft((x) => ({ ...x, webhookId: e.target.value }))} /></label>
            </> : <>
              <label className="text-sm font-medium">Stripe Secret Key<input type="password" autoComplete="new-password" className={inputClass} value={draft.secretKey} onChange={(e) => setDraft((x) => ({ ...x, secretKey: e.target.value }))} /></label>
              <label className="text-sm font-medium">Stripe Webhook Secret<input type="password" autoComplete="new-password" className={inputClass} value={draft.webhookSecret} onChange={(e) => setDraft((x) => ({ ...x, webhookSecret: e.target.value }))} /></label>
            </>}
            <label className="text-sm font-medium">{t("Countries (ISO codes, comma separated)", "الدول (رموز ISO مفصولة بفواصل)")}<input className={inputClass} placeholder="SY, DE, US" value={draft.countries} onChange={(e) => setDraft((x) => ({ ...x, countries: e.target.value }))} /></label>
            <label className="text-sm font-medium">{t("Currencies (comma separated)", "العملات (مفصولة بفواصل)")}<input className={inputClass} placeholder="SYP, USD, EUR" value={draft.currencies} onChange={(e) => setDraft((x) => ({ ...x, currencies: e.target.value }))} /></label>
            <label className="text-sm font-medium">{t("Payment methods (comma separated)", "طرق الدفع (مفصولة بفواصل)")}<input className={inputClass} placeholder="card, wallet" value={draft.methods} onChange={(e) => setDraft((x) => ({ ...x, methods: e.target.value }))} /></label>
            <label className="text-sm font-medium">{t("Display order", "ترتيب العرض")}<input type="number" min={0} max={10000} className={inputClass} value={draft.sortOrder} onChange={(e) => setDraft((x) => ({ ...x, sortOrder: Number(e.target.value) }))} /></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void create()} className="rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("Saving…", "جارٍ الحفظ…") : t("Save encrypted configuration", "حفظ الإعدادات المشفرة")}</button><button type="button" onClick={() => { setDraft(emptyDraft); setShowForm(false); }} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold">{t("Cancel", "إلغاء")}</button></div>
        </section>}

        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="font-semibold">{t("Credential encryption key rotation", "تدوير مفاتيح تشفير بيانات الاعتماد")}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("After adding the new key to PAYMENT_PROVIDER_ENCRYPTION_KEYS and selecting its version, run this operation to re-encrypt provider configurations and historical payment snapshots. Never remove old keys until both remaining counts are zero.", "بعد إضافة المفتاح الجديد إلى PAYMENT_PROVIDER_ENCRYPTION_KEYS وتحديد إصداره، نفّذ هذه العملية لإعادة تشفير إعدادات المزود ونسخ المدفوعات التاريخية. لا تحذف المفاتيح القديمة قبل وصول كلا العدادين إلى الصفر.")}</p>
            </div>
            <button type="button" disabled={rotationBusy} onClick={() => void rotateCredentials()} className="rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{rotationBusy ? t("Re-encrypting…", "جارٍ إعادة التشفير…") : t("Re-encrypt with active key", "إعادة التشفير بالمفتاح النشط")}</button>
          </div>
          {rotationReport && <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs text-[var(--muted)]">{t("Active key version", "إصدار المفتاح النشط")}</p><p className="mt-1 font-semibold">{rotationReport.activeKeyVersion}</p></div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs text-[var(--muted)]">{t("Provider configs re-encrypted", "إعدادات المزود المعاد تشفيرها")}</p><p className="mt-1 font-semibold">{rotationReport.providerConfigsReencrypted}</p></div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs text-[var(--muted)]">{t("Payment snapshots re-encrypted", "نسخ المدفوعات المعاد تشفيرها")}</p><p className="mt-1 font-semibold">{rotationReport.paymentSnapshotsReencrypted}</p></div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs text-[var(--muted)]">{t("Remaining provider configs", "إعدادات المزود المتبقية")}</p><p className="mt-1 font-semibold">{rotationReport.remainingProviderConfigs}</p></div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs text-[var(--muted)]">{t("Remaining payment snapshots", "نسخ المدفوعات المتبقية")}</p><p className="mt-1 font-semibold">{rotationReport.remainingPaymentSnapshots}</p></div>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="text-xs text-[var(--muted)]">{t("Rotation status", "حالة التدوير")}</p><p className="mt-1 font-semibold">{rotationReport.complete ? t("Complete", "مكتمل") : t("Incomplete — keep old keys", "غير مكتمل — احتفظ بالمفاتيح القديمة")}</p></div>
          </div>}
        </section>

        <section className="mt-6 space-y-4">
          {loading ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">{t("Loading providers…", "جارٍ تحميل مزودي الدفع…")}</div> : visibleItems.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center"><h2 className="font-semibold">{t("No provider configurations yet", "لا توجد إعدادات لمزودي الدفع بعد")}</h2><p className="mt-2 text-sm text-[var(--muted)]">{t("Add Stripe or PayPal in test mode first.", "ابدأ بإضافة Stripe أو PayPal في بيئة الاختبار.")}</p></div> : visibleItems.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-[var(--color-ink-950)]">{item.displayName}</h2><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold">{translate(locale, item.environment, item.environment === "TEST" ? "اختبار" : "مباشر")}</span><StatusBadge locale={locale} status={item.status} /></div><p className="mt-2 text-xs text-[var(--muted)]">{item.providerKey} · {item.credentialsConfigured ? t("Credentials encrypted", "بيانات الاعتماد مشفرة") : t("Credentials missing", "بيانات الاعتماد غير موجودة")} · {item.credentialFingerprint || "—"}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busyId === item.id} onClick={() => beginEdit(item)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{t("Edit", "تعديل")}</button>
                <button type="button" disabled={busyId === item.id} onClick={() => void action(item.id, "verify")} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">{t("Verify", "تحقق")}</button>
                {item.status === "ACTIVE" ? <button type="button" disabled={busyId === item.id} onClick={() => void action(item.id, "disable")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">{t("Disable", "تعطيل")}</button> : <button type="button" disabled={busyId === item.id || item.lastVerificationStatus !== "SUCCESS"} onClick={() => void action(item.id, "enable")} className="rounded-lg bg-[#FF8C1C] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{t("Enable", "تفعيل")}</button>}
                <button type="button" disabled={busyId === item.id} onClick={() => void action(item.id, "archive")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">{t("Archive", "أرشفة")}</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-[var(--muted)]">{t("Countries", "الدول")}</p><p className="mt-1">{item.supportedCountries.join(", ") || t("Not restricted", "غير محددة")}</p></div>
              <div><p className="text-xs text-[var(--muted)]">{t("Currencies", "العملات")}</p><p className="mt-1">{item.supportedCurrencies.join(", ") || t("Not restricted", "غير محددة")}</p></div>
              <div><p className="text-xs text-[var(--muted)]">{t("Methods", "الطرق")}</p><p className="mt-1">{item.enabledPaymentMethods.join(", ") || "—"}</p></div>
            </div>
            {editingId === item.id && <div className="mt-5 rounded-xl bg-[var(--surface-soft)] p-4">
              <h3 className="font-semibold">{t("Edit provider configuration", "تعديل إعدادات مزود الدفع")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-medium">{t("Display name", "الاسم الظاهر")}<input className={inputClass} value={editDraft.displayName} onChange={(e) => setEditDraft((x) => ({ ...x, displayName: e.target.value }))} /></label>
                <label className="text-xs font-medium">{t("Countries", "الدول")}<input className={inputClass} value={editDraft.countries} onChange={(e) => setEditDraft((x) => ({ ...x, countries: e.target.value }))} /></label>
                <label className="text-xs font-medium">{t("Currencies", "العملات")}<input className={inputClass} value={editDraft.currencies} onChange={(e) => setEditDraft((x) => ({ ...x, currencies: e.target.value }))} /></label>
                <label className="text-xs font-medium">{t("Methods", "طرق الدفع")}<input className={inputClass} value={editDraft.methods} onChange={(e) => setEditDraft((x) => ({ ...x, methods: e.target.value }))} /></label>
                <label className="text-xs font-medium">{t("Display order", "ترتيب العرض")}<input type="number" min={0} max={10000} className={inputClass} value={editDraft.sortOrder} onChange={(e) => setEditDraft((x) => ({ ...x, sortOrder: Number(e.target.value) }))} /></label>
                <label className="text-xs font-medium">{t("Replace credentials (optional)", "استبدال بيانات الاعتماد (اختياري)")}<input type="password" autoComplete="new-password" className={inputClass} placeholder={item.providerKey === "paypal" ? "New Client ID" : "New Secret Key"} value={editDraft.secretA} onChange={(e) => setEditDraft((x) => ({ ...x, secretA: e.target.value }))} /></label>
                <label className="text-xs font-medium">{item.providerKey === "paypal" ? "New Client Secret" : "New Webhook Secret"}<input type="password" autoComplete="new-password" className={inputClass} value={editDraft.secretB} onChange={(e) => setEditDraft((x) => ({ ...x, secretB: e.target.value }))} /></label>
                {item.providerKey === "paypal" && <label className="text-xs font-medium">New Webhook ID<input className={inputClass} value={editDraft.webhookId} onChange={(e) => setEditDraft((x) => ({ ...x, webhookId: e.target.value }))} /></label>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busyId === item.id} onClick={() => void saveEdit(item)} className="rounded-lg bg-[#FF8C1C] px-4 py-2 text-xs font-semibold text-white">{t("Save changes", "حفظ التغييرات")}</button><button type="button" onClick={() => setEditingId("")} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-semibold">{t("Cancel", "إلغاء")}</button></div>
            </div>}
            <p className="mt-3 text-xs text-[var(--muted)]">{item.lastVerifiedAt ? t("Last verified", "آخر تحقق") + ": " + new Date(item.lastVerifiedAt).toLocaleString() : t("Not verified yet", "لم يتم التحقق بعد")} {item.lastVerificationMessage ? "· " + item.lastVerificationMessage : ""}</p>
          </article>)}
        </section>
      </div>
    </main>
  );
}
