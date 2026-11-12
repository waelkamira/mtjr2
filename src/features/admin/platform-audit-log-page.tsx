"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type AuditEvent = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  scopeType: string | null;
  scopeId: string | null;
  metadata: unknown;
  occurredAt: string;
  actor: { displayName: string | null; email: string } | null;
};

type AuditResponse = { events: AuditEvent[]; nextCursor: string | null; limit: number };

export default function PlatformAuditLogPage() {
  const { locale } = useLocale();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (next: string | null, append: boolean, actionFilter: string, resourceFilter: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (resourceFilter.trim()) params.set("resource", resourceFilter.trim());
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/control-panel/audit-log?${params}`, { cache: "no-store" });
      const data = await response.json() as AuditResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Unable to load audit events.", "تعذر تحميل أحداث التدقيق."));
      setEvents((current) => append ? [...current, ...data.events] : data.events);
      setNextCursor(data.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load audit events.", "تعذر تحميل أحداث التدقيق."));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void Promise.resolve().then(() => load(null, false, "", "")); }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvents([]);
    setNextCursor(null);
    void load(null, false, action, resource);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/control-panel" className="text-sm font-medium text-[var(--color-copper-600)] hover:underline">← {translate(locale, "Platform control panel", "لوحة تحكم المنصة")}</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{translate(locale, "Security & governance", "الأمن والحوكمة")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{translate(locale, "Platform audit log", "سجل تدقيق المنصة")}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{translate(locale, "Read-only history of privileged and operational changes recorded by the platform.", "سجل للقراءة فقط للتغييرات المميزة والتشغيلية التي سجلتها المنصة.")}</p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]">{translate(locale, "Newest first · private data", "الأحدث أولًا · بيانات خاصة")}</span>
        </div>

        <form onSubmit={applyFilters} className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Action contains", "الإجراء يتضمن")}<input type="search" value={action} onChange={(event) => setAction(event.target.value)} maxLength={160} placeholder="identity.role_assignment" className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-50" /></label>
          <label className="text-xs font-medium text-[var(--muted)]">{translate(locale, "Resource contains", "المورد يتضمن")}<input type="search" value={resource} onChange={(event) => setResource(event.target.value)} maxLength={120} placeholder="user_role_assignment" className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]" /></label>
          <button disabled={loading} className="self-end rounded-lg bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F0780B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 disabled:opacity-60">{translate(locale, "Filter", "تصفية")}</button>
        </form>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <section aria-busy={loading} className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {events.length === 0 && !loading ? <p className="p-8 text-center text-sm text-[var(--muted)]">{translate(locale, "No audit events match these filters.", "لا توجد أحداث تدقيق تطابق عوامل التصفية هذه.")}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--color-ivory-100)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3 font-medium">{translate(locale, "When", "الوقت")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Actor", "المنفّذ")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Action", "الإجراء")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Resource", "المورد")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Scope", "النطاق")}</th><th className="px-4 py-3 font-medium">{translate(locale, "Details", "التفاصيل")}</th></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {events.map((event) => (
                    <tr key={event.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">{new Date(event.occurredAt).toLocaleString(locale)}</td>
                      <td className="px-4 py-3"><div className="font-medium">{event.actor?.displayName || event.actor?.email || event.actorId || event.actorType}</div><div className="mt-1 text-xs text-[var(--muted)]">{event.actorType}</div></td>
                      <td className="px-4 py-3 font-medium text-[var(--color-forest-950)]">{event.action}</td>
                      <td className="px-4 py-3"><div>{event.resource}</div><div className="mt-1 break-all text-xs text-[var(--muted)]">{event.resourceId || "—"}</div></td>
                      <td className="px-4 py-3 text-xs">{event.scopeType ? `${event.scopeType}: ${event.scopeId || "—"}` : "—"}</td>
                      <td className="max-w-sm px-4 py-3"><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{event.metadata ? JSON.stringify(event.metadata, null, 2) : "—"}</pre></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {loading && <p role="status" className="border-t border-[var(--border)] p-4 text-sm text-[var(--muted)]">{translate(locale, "Loading audit events…", "جارٍ تحميل أحداث التدقيق…")}</p>}
          {!loading && nextCursor && <div className="border-t border-[var(--border)] p-4 text-center"><button onClick={() => void load(nextCursor, true, action, resource)} className="rounded-lg bg-[#FF8C1C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#F0780B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100">{translate(locale, "Load older events", "تحميل أحداث أقدم")}</button></div>}
        </section>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{translate(locale, "Audit events are displayed as recorded. This view does not permit editing or deleting history.", "تُعرض أحداث التدقيق كما سُجلت. لا يسمح هذا العرض بتعديل السجل أو حذفه.")}</p>
      </div>
    </main>
  );
}
