"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Settings = {
  enabled: boolean;
  model: string;
  maxCompletionTokens: number;
  environmentEnabled: boolean;
  providerKeyConfigured: boolean;
  effectiveEnabled: boolean;
  updatedAt?: string;
};

export default function AiAssistantSettingsPage() {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState({ enabled: false, model: "openai/gpt-oss-20b", maxCompletionTokens: 900 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchSettings = useCallback(async () => {
    const response = await fetch("/api/admin/control-panel/ai-assistant", { cache: "no-store" });
    const data = await response.json() as Settings & { error?: string };
    if (!response.ok) throw new Error(data.error || t("Unable to load assistant settings.", "تعذر تحميل إعدادات المساعد."));
    return data;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSettings();
      setSettings(data);
      setDraft({ enabled: data.enabled, model: data.model, maxCompletionTokens: data.maxCompletionTokens });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Unable to load assistant settings.", "تعذر تحميل إعدادات المساعد."));
    } finally {
      setLoading(false);
    }
  }, [fetchSettings, t]);

  useEffect(() => {
    let active = true;
    void load().finally(() => { if (!active) return; });
    return () => { active = false; };
  }, [load]);

  async function save() {
    if (!settings || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/control-panel/ai-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
        cache: "no-store"
      });
      const data = await response.json() as Settings & { error?: string };
      if (!response.ok) throw new Error(data.error || t("Unable to save assistant settings.", "تعذر حفظ إعدادات المساعد."));
      setSettings(data);
      setDraft({ enabled: data.enabled, model: data.model, maxCompletionTokens: data.maxCompletionTokens });
      setNotice(t("Settings saved and recorded in the platform audit log.", "تم حفظ الإعدادات وتسجيل التغيير في سجل تدقيق المنصة."));
      toast.success(t("Assistant settings saved.", "تم حفظ إعدادات المساعد."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Unable to save assistant settings.", "تعذر حفظ إعدادات المساعد."); setError(message); toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const canEnable = Boolean(settings?.environmentEnabled && settings.providerKeyConfigured);

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-orange-600)]">{t("Platform operations", "عمليات المنصة")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("AI assistant", "المساعد الذكي")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("Control the customer-facing assistant. The deployment environment remains the master kill switch, and the provider secret is never exposed here.", "تحكم بالمساعد الظاهر للعملاء. تظل بيئة التشغيل مفتاح الإيقاف الرئيسي، ولا يتم كشف سر مزود الخدمة هنا.")}</p>

        {loading && <p role="status" className="mt-8 text-sm text-[var(--muted)]">{t("Loading settings…", "جارٍ تحميل الإعدادات…")}</p>}
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

        {settings && !loading && <div aria-busy={loading || saving} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{t("Runtime status", "حالة التشغيل")}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{settings.effectiveEnabled ? t("The assistant is enabled by all required switches.", "المساعد مفعّل بعد اجتياز جميع مفاتيح التشغيل.") : t("The assistant is currently disabled.", "المساعد معطّل حاليًا.")}</p>
              </div>
              <span className={settings.effectiveEnabled ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"}>{settings.effectiveEnabled ? t("Enabled", "مفعّل") : t("Disabled", "معطّل")}</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                <p className="text-xs text-[var(--muted)]">{t("Deployment master switch", "مفتاح بيئة التشغيل")}</p>
                <p className="mt-1 font-semibold">{settings.environmentEnabled ? t("Enabled", "مفعّل") : t("Disabled", "معطّل")}</p>
              </div>
              <div className="rounded-xl bg-[var(--color-ivory-100)] p-4">
                <p className="text-xs text-[var(--muted)]">{t("Groq API key", "مفتاح Groq API")}</p>
                <p className="mt-1 font-semibold">{settings.providerKeyConfigured ? t("Configured · value hidden", "مُعدّ · القيمة مخفية") : t("Not configured", "غير مُعدّ")}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-6">
            <h2 className="text-lg font-semibold text-[var(--color-forest-950)]">{t("Assistant configuration", "إعدادات المساعد")}</h2>
            <label className="mt-5 flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-semibold">{t("Enable customer assistant", "تفعيل مساعد العملاء")}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{t("Both the deployment switch and a configured provider key are required.", "يتطلب التفعيل مفتاح بيئة التشغيل ووجود مفتاح مزود الخدمة.")}</span>
              </span>
              <input type="checkbox" checked={draft.enabled} disabled={!canEnable && !draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} className="mt-1 size-5 accent-[#FF8C1C]" />
            </label>
            {!canEnable && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{!settings.environmentEnabled ? t("The deployment master switch is off. Enabling is blocked until an operator enables AI_ASSISTANT_ENABLED in the runtime environment.", "مفتاح بيئة التشغيل مغلق. لن يمكن التفعيل حتى يفعّل المسؤول AI_ASSISTANT_ENABLED في بيئة التشغيل.") : t("The Groq API key is missing. Add it as a server-only runtime secret; never paste it here.", "مفتاح Groq API غير موجود. أضفه كسِرّ خادمي في بيئة التشغيل، ولا تلصقه هنا.")}</p>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">{t("Model", "النموذج")}<input readOnly value={draft.model} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-3 text-sm text-[var(--foreground)]" /></label>
              <label className="block text-sm font-medium">{t("Maximum completion tokens", "الحد الأقصى لرموز الإجابة")}<input type="number" min={128} max={1200} step={1} value={draft.maxCompletionTokens} onChange={(event) => setDraft((current) => ({ ...current, maxCompletionTokens: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)]" /></label>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void save()} disabled={saving || loading || !settings} className="rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("Saving…", "جارٍ الحفظ…") : t("Save settings", "حفظ الإعدادات")}</button>
              <button type="button" onClick={() => void load()} disabled={saving || loading} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50">{t("Reload", "إعادة التحميل")}</button>
            </div>
          </section>
          <p className="text-xs leading-5 text-[var(--muted)]">{t("Every change is recorded in the immutable platform audit log. This page never reads or returns the provider secret. Conversation history, usage analytics, and distributed rate limiting are separate follow-up work and are not represented as available here.", "يُسجّل كل تغيير في سجل تدقيق المنصة. لا تقرأ هذه الصفحة سر مزود الخدمة ولا تعيده. سجل المحادثات وتحليلات الاستخدام وتحديد المعدل الموزع أعمال منفصلة لم تُنفّذ بعد.")}</p>
        </div>}
      </div>
    </main>
  );
}
