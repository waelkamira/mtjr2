"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Report = {
  id: string; reason: string; details: string | null; createdAt: string; reporter: string;
  question: { id: string; question: string; product: { id: string; name: string } };
  answer: { id: string; body: string } | null;
};

export default function ProductQaReportsPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function load() {
    const response = await fetch("/api/admin/questions/reports", { cache: "no-store" });
    const data = await response.json() as { items?: Report[]; error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Reports unavailable.", "البلاغات غير متاحة."));
    setItems(data.items || []);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/admin/questions/reports", { cache: "no-store" }).then(async response => {
      const data = await response.json() as { items?: Report[]; error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Reports unavailable.", "البلاغات غير متاحة."));
      if (active) setItems(data.items || []);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Reports unavailable.", "البلاغات غير متاحة.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);
  async function moderate(id: string, decision: "REVIEW" | "DISMISS") {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/admin/questions/reports/${encodeURIComponent(id)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Moderation failed.", "تعذّر الإشراف."));
      await load();
      toast.success(translate(locale, "Report decision saved.", "تم حفظ قرار البلاغ."));
    } catch (cause) { const message = cause instanceof Error ? cause.message : translate(locale, "Moderation failed.", "تعذّر الإشراف."); setError(message); toast.error(message);
    finally { setBusy(""); }
  }
  return <main className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-5"><div className="mx-auto flex max-w-5xl justify-between">
      <Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link>
      <Link href="/admin/questions" className="text-sm">{translate(locale, "Q&A moderation", "الإشراف على الأسئلة والأجوبة")}</Link>
    </div></header>
    <div className="mx-auto max-w-5xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{translate(locale, "Trust & safety", "الثقة والسلامة")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Product Q&A reports", "بلاغات أسئلة وأجوبة المنتجات")}</h1>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-6 h-32 animate-pulse rounded-3xl bg-[var(--surface-soft)]" /> :
        items.length ? <div className="mt-6 space-y-4">{items.map(item => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs text-[var(--muted)]">{item.question.product.name} · {translate(locale, "reported by", "أبلغ عنه")} {item.reporter} · {item.reason}</p>
          <p className="mt-3 font-medium">{translate(locale, "Q:", "س:")} {item.question.question}</p>
          {item.answer && <p className="mt-2 border-l-2 border-[var(--color-lavender-600)] pl-3 text-sm">{translate(locale, "A:", "ج:")} {item.answer.body}</p>}
          {item.details && <p className="mt-3 text-sm text-[var(--muted)]">{item.details}</p>}
          <div className="mt-4 flex gap-3">
            <button disabled={busy === item.id} onClick={() => void moderate(item.id, "REVIEW")} className="rounded-xl bg-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{translate(locale, "Mark reviewed", "تحديد كمراجع")}</button>
            <button disabled={busy === item.id} onClick={() => void moderate(item.id, "DISMISS")} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">{translate(locale, "Dismiss", "تجاهل")}</button>
          </div>
        </article>)}</div> : <p className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">{translate(locale, "No open reports.", "لا توجد بلاغات مفتوحة.")}</p>}
    </div>
  </main>;
}
