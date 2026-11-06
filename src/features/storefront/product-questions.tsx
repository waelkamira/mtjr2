"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AuthReturnLink from "@/components/auth-return-link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Answer = { id: string; body: string; author: string; createdAt: string };
type Question = { id: string; question: string; author: string; createdAt: string; answers: Answer[] };

export default function ProductQuestions({ productId }: { productId: string }) {
  const { locale } = useLocale();
  const t = useCallback((english: string, arabic: string) => translate(locale, english, arabic), [locale]);
  const [items, setItems] = useState<Question[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/products/${encodeURIComponent(productId)}/questions`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { items?: Question[] };
        if (!response.ok) throw new Error(t("Product questions could not be loaded.", "تعذّر تحميل أسئلة المنتج."));
        if (active) setItems(data.items || []);
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t("Product questions could not be loaded.", "تعذّر تحميل أسئلة المنتج.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, t]);
  async function report(questionId: string, answerId?: string) {
    setReportMessage("");
    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(questionId)}/reports`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, reason: "OTHER" })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Report could not be submitted.", "تعذّر إرسال البلاغ."));
      setReportMessage(t("Thank you. Your report was sent to the moderation team.", "شكرًا لك. أُرسل بلاغك إلى فريق الإشراف."));
    } catch (cause) {
      setReportMessage(cause instanceof Error ? cause.message : t("Report could not be submitted.", "تعذّر إرسال البلاغ."));
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Question could not be submitted.", "تعذّر إرسال السؤال."));
      setQuestion(""); setMessage(t("Your question was submitted and is awaiting moderation.", "أُرسل سؤالك وهو بانتظار المراجعة."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Question could not be submitted.", "تعذّر إرسال السؤال.")); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-6xl px-5 pb-12"><div className="border-t border-[var(--border)] pt-9">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{t("Before you buy", "قبل الشراء")}</p><h2 className="mt-2 text-xl font-semibold text-[var(--color-forest-950)]">{t("Questions and answers", "الأسئلة والأجوبة")}</h2>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {loading ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : items.length ? <div className="mt-5 space-y-4">{reportMessage && <p role="status" className="rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm">{reportMessage}</p>}{items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-[var(--color-forest-950)]">{t("Q:", "س:")} {item.question}</p><button type="button" onClick={() => void report(item.id)} className="mt-2 text-xs font-medium text-[var(--color-copper-600)] underline">{t("Report question", "الإبلاغ عن السؤال")}</button><span className="text-xs text-[var(--muted)]">{item.author} · {new Date(item.createdAt).toLocaleDateString(locale)}</span></div>{item.answers.map((answer) => <div key={answer.id} className="mt-4 border-l-2 border-[var(--color-copper-600)] pl-4"><p className="text-sm leading-6 text-[var(--muted)]">{t("A:", "ج:")} {answer.body}</p><p className="mt-1 text-xs text-[var(--muted)]">{answer.author} · {new Date(answer.createdAt).toLocaleDateString(locale)}</p><button type="button" onClick={() => void report(item.id, answer.id)} className="mt-1 text-xs font-medium text-[var(--color-copper-600)] underline">{t("Report answer", "الإبلاغ عن الإجابة")}</button></div>)}</article>)}</div> : <p className="mt-5 text-sm text-[var(--muted)]">{t("No published questions yet. Be the first to ask.", "لا توجد أسئلة منشورة بعد. كن أول من يطرح سؤالًا.")}</p>}
    <form onSubmit={submit} className="mt-6 rounded-2xl bg-[var(--color-ivory-100)] p-5"><label className="block text-sm font-semibold text-[var(--color-forest-950)]">{t("Ask about this product", "اسأل عن هذا المنتج")}<textarea required minLength={10} maxLength={2000} rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("Ask about size, compatibility, materials or delivery…", "اسأل عن المقاس أو التوافق أو المواد أو التوصيل…")} className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 font-normal" /></label>
      {message && <p role="status" className="mt-3 text-sm text-[var(--color-forest-800)]">{message}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">{t("Questions appear publicly after moderation.", "تظهر الأسئلة للعامة بعد مراجعتها.")}</p><button disabled={busy} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Submitting…", "جارٍ الإرسال…") : t("Submit question", "إرسال السؤال")}</button></div>
      {(error.includes("Sign in") || error.includes("تسجيل الدخول")) && <AuthReturnLink href="/login" className="mt-2 inline-block text-sm font-semibold underline">{t("Sign in to continue", "سجّل الدخول للمتابعة")}</AuthReturnLink>}
    </form>
  </div></section>;
}
