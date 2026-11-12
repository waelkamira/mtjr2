"use client";

import { StatusBadge } from "@/components/status-badge";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import MetricBarChart from "@/components/analytics/metric-bar-chart";

type Answer = { id: string; body: string; status: string; createdAt: string };
type Revision = { id: string; body: string; createdAt: string };
type Item = {
  id: string; question: string; status: string; createdAt: string; author: string;
  product: { name: string; slug: string; store: { name: string } };
  answers: Answer[];
};

export default function SellerQuestionsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [histories, setHistories] = useState<Record<string, Revision[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState("");

  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const statusLabel = (status: string) => translateStatus(locale, status);

  async function load() {
    const response = await fetch("/api/seller/questions", { cache: "no-store" });
    const data = await response.json() as { items?: Item[]; error?: string };
    if (!response.ok) throw new Error(data.error || t("Seller questions unavailable.", "تعذر تحميل أسئلة البائع."));
    setItems(data.items ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/seller/questions", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { items?: Item[]; error?: string };
        if (!response.ok) throw new Error(data.error || t("Seller questions unavailable.", "تعذر تحميل أسئلة البائع."));
        if (active) setItems(data.items ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("Seller questions unavailable.", "تعذر تحميل أسئلة البائع."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  const questionStatusRows = Object.entries(items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>)).map(([status, value], index) => ({
    label: statusLabel(status), value,
    color: ["bg-amber-500", "bg-emerald-500", "bg-rose-500", "bg-sky-500"][index % 4]
  }));
  const answerCoverageRows = [
    { label: t("Answered", "تمت الإجابة"), value: items.filter((item) => item.answers.length > 0).length, color: "bg-emerald-500" },
    { label: t("Awaiting answer", "بانتظار الإجابة"), value: items.filter((item) => item.answers.length === 0).length, color: "bg-amber-500" }
  ];

  async function saveEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setBusy(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/seller/answers/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: answerDrafts[id] ?? "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Answer edit failed.", "تعذر تعديل الإجابة."));
      setEditing("");
      const success = t("Answer updated and sent for moderation.", "تم تحديث الإجابة وإرسالها للمراجعة.");
      setMessage(success); toast.success(success);
      await load();
    } catch (cause) {
      const failure = cause instanceof Error ? cause.message : t("Answer edit failed.", "تعذر تعديل الإجابة.");
      setError(failure); toast.error(failure);
    } finally { setBusy(""); }
  }

  async function showHistory(id: string) {
    setError(""); setHistoryLoading((current) => ({ ...current, [id]: true }));
    try {
      const response = await fetch(`/api/seller/answers/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json() as { revisions?: Revision[]; error?: string };
      if (!response.ok) throw new Error(data.error || t("History unavailable.", "تعذر تحميل السجل."));
      setHistories((current) => ({ ...current, [id]: data.revisions ?? [] }));
    } catch (cause) {
      const failure = cause instanceof Error ? cause.message : t("History unavailable.", "تعذر تحميل السجل.");
      setError(failure); toast.error(failure);
    } finally { setHistoryLoading((current) => ({ ...current, [id]: false })); }
  }

  async function answer(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setBusy(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(id)}/answers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: drafts[id] ?? "" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Answer submission failed.", "تعذر إرسال الإجابة."));
      setDrafts((current) => ({ ...current, [id]: "" }));
      const success = t("Answer submitted for moderation.", "تم إرسال الإجابة للمراجعة.");
      setMessage(success); toast.success(success);
      await load();
    } catch (cause) {
      const failure = cause instanceof Error ? cause.message : t("Answer submission failed.", "تعذر إرسال الإجابة.");
      setError(failure); toast.error(failure);
    } finally { setBusy(""); }
  }

  return <main className="min-h-screen bg-transparent px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1440px]">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#a94308]">{t("Customer engagement", "التفاعل مع العملاء")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Product questions", "أسئلة المنتجات")}</h1>
      {!loading && !error && items.length > 0 && <section aria-label={t("Product Q&A analytics", "تحليلات أسئلة المنتجات")} className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricBarChart title={t("Questions by moderation status", "الأسئلة حسب حالة المراجعة")} rows={questionStatusRows} />
        <MetricBarChart title={t("Question answer coverage", "تغطية الإجابة عن الأسئلة")} description={t("Based on the questions currently returned for your stores.", "استناداً إلى الأسئلة المعروضة حالياً لمتاجرك.")} rows={answerCoverageRows} />
      </section>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> : items.length ? <div className="mt-6 space-y-4">
        {items.map((item) => <article key={item.id} className="rounded-3xl border border-[#eee9e4] bg-white p-5 shadow-[0_8px_24px_rgba(119,86,62,.06)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs text-[var(--muted)]">{item.product.store.name} · {item.product.name}</p><h2 className="mt-2 font-semibold text-[var(--color-ink-950)]">{t("Q:", "س:")} {item.question}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("Asked by", "طرح السؤال")} {item.author} · {new Date(item.createdAt).toLocaleDateString(locale === "ar" ? "ar" : "en-GB")}</p></div>
            <StatusBadge locale={locale} status={item.status} />
          </div>
          {item.answers.map((entry) => <div key={entry.id} className="mt-4 rounded-2xl border border-[#eee9e4] bg-[#fffaf6] p-4">
            <p className="text-sm font-medium text-[#454545]">{t("Answer", "الإجابة")} · <StatusBadge locale={locale} status={entry.status} /></p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#475569]">{entry.body}</p>
            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" onClick={() => { setEditing(entry.id); setAnswerDrafts((current) => ({ ...current, [entry.id]: entry.body })); }} className="text-xs font-semibold text-[#a94308] underline underline-offset-4">{t("Edit answer", "تعديل الإجابة")}</button>
              <button type="button" disabled={historyLoading[entry.id]} onClick={() => void showHistory(entry.id)} className="text-xs font-semibold text-[#475569] underline underline-offset-4 disabled:opacity-50">{historyLoading[entry.id] ? t("Loading history…", "جارٍ تحميل السجل…") : t("View history", "عرض السجل")}</button>
            </div>
            {histories[entry.id]?.map((revision) => <p key={revision.id} className="mt-3 border-s-2 border-[#d5dbe1] ps-3 text-xs leading-5 text-[var(--muted)]">{t("Previous version", "نسخة سابقة")} · {new Date(revision.createdAt).toLocaleString(locale === "ar" ? "ar" : "en-GB")}: {revision.body}</p>)}
            {editing === entry.id && <form onSubmit={(event) => void saveEdit(event, entry.id)} className="mt-4 border-t border-[#eadfd5] pt-4">
              <textarea required minLength={3} maxLength={4000} rows={3} value={answerDrafts[entry.id] ?? ""} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} className="block w-full rounded-xl border border-[#eee9e4] bg-white px-3 py-3 text-sm text-[#454545] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-[#FF8C1C]/15" />
              <div className="mt-3 flex gap-2"><button disabled={busy === entry.id} className="rounded-xl bg-[#FF8C1C] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy === entry.id ? t("Saving…", "جارٍ الحفظ…") : t("Save for moderation", "حفظ للمراجعة")}</button><button type="button" onClick={() => setEditing("")} className="rounded-xl border border-[#d8dee5] px-4 py-2.5 text-xs font-semibold text-[#475569]">{t("Cancel", "إلغاء")}</button></div>
            </form>}
          </div>)}
          {item.status === "PUBLISHED" && <form onSubmit={(event) => void answer(event, item.id)} className="mt-5 border-t border-[#eadfd5] pt-4">
            <label className="block text-sm font-medium text-[#334155]">{t("Write an answer", "اكتب إجابة")}<textarea required minLength={3} maxLength={4000} rows={3} value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[#d8dee5] bg-white px-3 py-3 text-sm text-[#253548] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-[#FF8C1C]/15" /></label>
            <button disabled={busy === item.id} className="mt-3 rounded-xl bg-[#FF8C1C] px-5 py-3 text-sm font-bold text-white hover:bg-[#E8750B] disabled:opacity-50">{busy === item.id ? t("Submitting…", "جارٍ الإرسال…") : t("Submit answer", "إرسال الإجابة")}</button>
          </form>}
        </article>)}
      </div> : !error ? <p className="mt-6 rounded-2xl border border-[#eadfd5] bg-white p-6 text-sm text-[var(--muted)]">{t("No product questions for your stores.", "لا توجد أسئلة عن منتجات متاجرك.")}</p> : null}
    </div>
  </main>;
}
