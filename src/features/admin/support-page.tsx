"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate, translateStatus } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type Row = {
  id: string; ticketNumber: string; subject: string; category: string; status: string;
  priority: string; updatedAt: string; customer: string; assignee: string | null;
  messageCount: number; resolutionDueAt: string | null; resolutionBreachedAt: string | null;
};
type Message = { id: string; body: string; internal: boolean; createdAt: string; author: string };
type Detail = {
  id: string; ticketNumber: string; subject: string; status: string; priority: string;
  customer: { email: string; displayName: string | null }; messages: Message[];
  firstResponseDueAt: string | null; resolutionDueAt: string | null;
  firstResponseBreachedAt: string | null; resolutionBreachedAt: string | null; escalatedAt: string | null;
};

const ticketStatuses = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function AdminSupportPage() {
  const { locale } = useLocale();
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [ticket, setTicket] = useState<Detail | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const statusLabel = (value: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      OPEN: { en: "Open", ar: "مفتوحة" },
      IN_PROGRESS: { en: "In progress", ar: "قيد المعالجة" },
      WAITING_CUSTOMER: { en: "Waiting for customer", ar: "بانتظار العميل" },
      RESOLVED: { en: "Resolved", ar: "تم الحل" },
      CLOSED: { en: "Closed", ar: "مغلقة" },
      LOW: { en: "Low", ar: "منخفضة" },
      NORMAL: { en: "Normal", ar: "عادية" },
      HIGH: { en: "High", ar: "مرتفعة" },
      URGENT: { en: "Urgent", ar: "عاجلة" }
    };
    const label = labels[value];
    return label ? translate(locale, label.en, label.ar) : translateStatus(locale, value);
  };

  async function loadQueue() {
    const response = await fetch("/api/admin/support/tickets", { cache: "no-store" });
    const data = await response.json() as { items?: Row[]; error?: string };
    if (!response.ok) throw new Error(data.error || translate(locale, "Support queue unavailable.", "قائمة الدعم غير متاحة."));
    setItems(data.items || []);
    if (!selected && data.items?.[0]) setSelected(data.items[0].id);
  }

  async function loadTicket(id: string) {
    const response = await fetch(`/api/admin/support/tickets/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json() as { ticket?: Detail; error?: string };
    if (!response.ok || !data.ticket) throw new Error(data.error || translate(locale, "Ticket unavailable.", "التذكرة غير متاحة."));
    setTicket(data.ticket);
    setStatus(data.ticket.status);
    setPriority(data.ticket.priority);
  }

  useEffect(() => {
    let live = true;
    fetch("/api/admin/support/tickets", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { items?: Row[]; error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Support queue unavailable.", "قائمة الدعم غير متاحة."));
      if (live) {
        setItems(data.items || []);
        if (data.items?.[0]) setSelected(data.items[0].id);
      }
    }).catch((cause) => {
      if (live) setError(cause instanceof Error ? cause.message : translate(locale, "Support queue unavailable.", "قائمة الدعم غير متاحة."));
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [locale]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    fetch(`/api/admin/support/tickets/${encodeURIComponent(selected)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { ticket?: Detail; error?: string };
      if (!response.ok || !data.ticket) throw new Error(data.error || translate(locale, "Ticket unavailable.", "التذكرة غير متاحة."));
      if (live) {
        setTicket(data.ticket);
        setStatus(data.ticket.status);
        setPriority(data.ticket.priority);
      }
    }).catch((cause) => {
      if (live) setError(cause instanceof Error ? cause.message : translate(locale, "Ticket unavailable.", "التذكرة غير متاحة."));
    });
    return () => { live = false; };
  }, [locale, selected]);

  async function patch(payload: object) {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/support/tickets/${encodeURIComponent(selected)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Update failed.", "تعذر التحديث."));
      await loadQueue();
      await loadTicket(selected);
      toast.success(translate(locale, "Support ticket updated.", "تم تحديث تذكرة الدعم."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Update failed.", "تعذر التحديث."); setError(message); toast.error(message);
    } finally { setBusy(false); }
  }

  async function reply(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/support/tickets/${encodeURIComponent(selected)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, internal })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Reply failed.", "تعذر إرسال الرد."));
      setBody("");
      await loadTicket(selected);
      await loadQueue();
      toast.success(translate(locale, "Reply sent.", "تم إرسال الرد."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : translate(locale, "Reply failed.", "تعذر إرسال الرد."); setError(message); toast.error(message);
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-5">
        <div className="mx-auto flex max-w-7xl justify-between">
          <Link href="/" className="text-xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link>
          <span className="text-sm text-[var(--muted)]">{translate(locale, "Platform administration", "إدارة المنصة")}</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-lavender-600)]">{translate(locale, "Customer operations", "عمليات العملاء")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">{translate(locale, "Support desk", "مكتب الدعم")}</h1>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {loading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" /> : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
            <aside className="space-y-2">
              {items.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`w-full rounded-2xl border p-4 text-left ${selected === item.id ? "border-[#FF8C1C] bg-orange-50/70 shadow-sm" : "border-[var(--border)] bg-[var(--surface)]/60 hover:border-[#FF8C1C]/50"}`}>
                <div className="flex justify-between gap-2"><span className="text-xs font-semibold text-[var(--color-lavender-600)]">{item.ticketNumber}</span><span className="text-xs">{statusLabel(item.priority)}</span></div>
                <p className="mt-2 font-semibold">{item.subject}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{item.customer} · <StatusBadge locale={locale} status={item.status} /></p>
                {item.resolutionBreachedAt && <p className="mt-2 text-xs font-semibold text-red-700">{translate(locale, "Resolution SLA breached", "تم تجاوز مهلة الحل")}</p>}
              </button>)}
              {!items.length && <p className="rounded-2xl bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">{translate(locale, "No support tickets.", "لا توجد تذاكر دعم.")}</p>}
            </aside>
            <section>{ticket && <>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div><p className="text-xs text-[var(--color-lavender-600)]">{ticket.ticketNumber} · {ticket.customer.email}</p><h2 className="mt-1 text-xl font-semibold">{ticket.subject}</h2></div>
                  <div className="flex gap-2">
                    <select aria-label={translate(locale, "Status", "الحالة")} value={status} onChange={(event) => { setStatus(event.target.value); void patch({ status: event.target.value }); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[#FF8C1C] focus:outline-none focus:ring-2 focus:ring-orange-200">{ticketStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
                    <select aria-label={translate(locale, "Priority", "الأولوية")} value={priority} onChange={(event) => { setPriority(event.target.value); void patch({ priority: event.target.value }); }} className="rounded-lg border p-2 text-sm">{priorities.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">{translate(locale, "First response due:", "موعد الرد الأول:")} {ticket.firstResponseDueAt ? new Date(ticket.firstResponseDueAt).toLocaleString() : "—"} · {translate(locale, "Resolution due:", "موعد الحل:")} {ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : "—"}</p>
                {(ticket.firstResponseBreachedAt || ticket.resolutionBreachedAt) && <p className="mt-2 text-xs font-semibold text-red-700">{translate(locale, "SLA breach recorded", "تم تسجيل تجاوز اتفاقية مستوى الخدمة")}{ticket.escalatedAt ? ` · ${translate(locale, "Escalated", "تم التصعيد")} ${new Date(ticket.escalatedAt).toLocaleString()}` : ""}</p>}
                <button disabled={busy} onClick={() => void patch({ assignToMe: true })} className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold">{translate(locale, "Assign to me", "إسناد إليّ")}</button>
                <span className="ml-3 text-xs text-[var(--muted)]">{items.find((item) => item.id === selected)?.assignee || translate(locale, "Unassigned", "غير مسندة")}</span>
              </div>
              <div className="mt-4 space-y-3">{ticket.messages.map((message) => <article key={message.id} className={`rounded-2xl border p-5 ${message.internal ? "border-dashed border-[var(--color-lavender-600)] bg-[var(--surface-soft)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                <div className="flex justify-between gap-3"><span className="text-sm font-semibold">{message.author}{message.internal ? ` · ${translate(locale, "Internal note", "ملاحظة داخلية")}` : ""}</span><time className="text-xs text-[var(--muted)]">{new Date(message.createdAt).toLocaleString()}</time></div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
              </article>)}</div>
              <form onSubmit={reply} className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <label className="block text-sm font-semibold">{translate(locale, "Reply or internal note", "رد أو ملاحظة داخلية")}<textarea required minLength={2} maxLength={8000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[#FF8C1C] focus:outline-none focus:ring-2 focus:ring-orange-200" /></label>
                <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#FF8C1C]" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> {translate(locale, "Internal note (not visible to customer)", "ملاحظة داخلية (لا تظهر للعميل)")}</label>
                <button disabled={busy} className="mt-3 rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? translate(locale, "Saving…", "جارٍ الحفظ…") : internal ? translate(locale, "Add internal note", "إضافة ملاحظة داخلية") : translate(locale, "Send reply", "إرسال الرد")}</button>
              </form>
            </>}</section>
          </div>
        )}
      </div>
    </main>
  );
}
