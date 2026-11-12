"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import Link from "next/link";
import { toast } from "sonner";

type Synonym = { id: string; locale: string; term: string; synonym: string; isActive: boolean };

async function readJson(response: Response) {
  const data = await response.json() as { items?: Synonym[]; item?: Synonym; error?: string };
  if (!response.ok) throw new Error(data.error || "Search synonym request failed.");
  return data;
}

export default function AdminSearchSynonymsPage() {
  const { locale: uiLocale } = useLocale();
  const t = (english: string, arabic: string) => translate(uiLocale, english, arabic);
  const [items, setItems] = useState<Synonym[]>([]);
  const [locale, setLocale] = useState("en");
  const [term, setTerm] = useState("");
  const [synonym, setSynonym] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const data = await readJson(await fetch("/api/admin/search-synonyms", { cache: "no-store" }));
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load synonym mappings.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await readJson(await fetch("/api/admin/search-synonyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, term, synonym })
      }));
      setTerm("");
      setSynonym("");
      setMessage("Synonym mapping created.");
      toast.success("Synonym mapping created.");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to create synonym mapping."; setError(message); toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(item: Synonym, isActive: boolean) {
    setBusyId(item.id);
    setError("");
    setMessage("");
    try {
      await readJson(await fetch(`/api/admin/search-synonyms/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      }));
      await load();
      setMessage(isActive ? "Synonym mapping activated." : "Synonym mapping deactivated.");
      toast.success(isActive ? "Synonym mapping activated." : "Synonym mapping deactivated.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to update synonym mapping."; setError(message); toast.error(message);
    } finally {
      setBusyId("");
    }
  }

  async function remove(item: Synonym) {
    setBusyId(item.id);
    setError("");
    setMessage("");
    try {
      await readJson(await fetch(`/api/admin/search-synonyms/${encodeURIComponent(item.id)}`, { method: "DELETE" }));
      await load();
      setMessage("Synonym mapping deleted.");
      toast.success("Synonym mapping deleted.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to delete synonym mapping."; setError(message); toast.error(message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white px-5 py-5">
        <div className="mx-auto flex max-w-5xl justify-between">
          <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <nav className="flex gap-4 text-sm"><Link href="/admin/review">{t("Admin", "الإدارة")}</Link><Link href="/admin/tax-rates">{t("Tax rules", "قواعد الضرائب")}</Link></nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-5 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{t("Platform administration", "إدارة المنصة")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{t("Search synonyms", "مرادفات البحث")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("Manage locale-specific equivalent search terms. Active mappings expand public product searches and autocomplete; terms are matched case-insensitively.", "أدر مصطلحات البحث المكافئة لكل لغة. توسّع المطابقات النشطة نتائج البحث العام واقتراحات الإكمال التلقائي، وتتم مطابقة المصطلحات دون تمييز حالة الأحرف.")}</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{message}</p>}
        <form onSubmit={create} className="mt-7 grid gap-4 rounded-3xl border border-[var(--border)] bg-white p-6 sm:grid-cols-3">
          <label className="grid gap-2 text-sm">{t("Locale", "اللغة")}<input required minLength={2} maxLength={16} pattern="[A-Za-z0-9-]+" value={locale} onChange={(event) => setLocale(event.target.value)} className="rounded-xl border border-[var(--border)] p-3" /></label>
          <label className="grid gap-2 text-sm">{t("Search term", "مصطلح البحث")}<input required minLength={2} maxLength={160} value={term} onChange={(event) => setTerm(event.target.value)} className="rounded-xl border border-[var(--border)] p-3" /></label>
          <label className="grid gap-2 text-sm">{t("Synonym", "المرادف")}<input required minLength={2} maxLength={160} value={synonym} onChange={(event) => setSynonym(event.target.value)} className="rounded-xl border border-[var(--border)] p-3" /></label>
          <button disabled={busy} className="rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-3">{busy ? "Saving…" : "Add synonym mapping"}</button>
        </form>
        <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-semibold">{t("Configured mappings", "المرادفات المهيأة")}</h2>
          {loading ? <p className="py-5 text-sm text-[var(--muted)]" role="status">{t("Loading mappings…", "جارٍ تحميل المرادفات…")}</p> : items.length ? (
            <div className="mt-4 divide-y divide-[var(--border)]">{items.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0">
              <div><p className="font-semibold">{item.term} ↔ {item.synonym}</p><p className="mt-1 text-xs text-[var(--muted)]">{item.locale} · <StatusBadge locale={locale} status={item.isActive ? "ACTIVE" : "INACTIVE"} /></p></div>
              <div className="flex gap-2"><button type="button" disabled={busyId === item.id} onClick={() => void setActive(item, !item.isActive)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50">{item.isActive ? t("Deactivate", "تعطيل") : t("Activate", "تفعيل")}</button><button type="button" disabled={busyId === item.id} onClick={() => void remove(item)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">{t("Delete", "حذف")}</button></div>
            </article>)}</div>
          ) : !error ? <p className="py-5 text-sm text-[var(--muted)]">{t("No synonym mappings configured.", "لم تتم إضافة مرادفات بعد.")}</p> : null}
        </section>
      </div>
    </main>
  );
}
