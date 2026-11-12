"use client";

import { StatusBadge } from "@/components/status-badge";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Message = { id: string; body: string; createdAt: string; author: string; senderId: string };
type Attachment = { id: string; fileName: string; contentType: string; sizeBytes: number; downloadUrl: string };
type Ticket = { id: string; ticketNumber: string; subject: string; category: string; status: string; priority: string; messages: Message[]; attachments: Attachment[] };
type UploadStart = { attachment: { id: string }; upload: { url: string; method: "PUT"; headers: Record<string, string> } };

export default function SupportTicketPage({ ticketId }: { ticketId: string }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
    const data = await response.json() as { ticket?: Ticket; error?: string };
    if (!response.ok || !data.ticket) throw new Error(data.error || t("Ticket unavailable.", "التذكرة غير متاحة."));
    setTicket(data.ticket);
  }

  useEffect(() => {
    let live = true;
    fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json() as { ticket?: Ticket; error?: string };
        if (!response.ok || !data.ticket) throw new Error(data.error || translate(locale, "Ticket unavailable.", "التذكرة غير متاحة."));
        if (live) setTicket(data.ticket);
      })
      .catch(cause => {
        if (live) setError(cause instanceof Error ? cause.message : translate(locale, "Ticket unavailable.", "التذكرة غير متاحة."));
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [ticketId, locale]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("Reply failed.", "تعذّر إرسال الرد."));
      setBody("");
      await load();
      toast.success(t("Reply sent.", "تم إرسال الرد."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Reply failed.", "تعذّر إرسال الرد.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!file) return;
    setUploadBusy(true);
    setError("");
    try {
      const endpoint = `/api/support/tickets/${encodeURIComponent(ticketId)}/attachments`;
      const init = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size })
      });
      const started = await init.json() as UploadStart & { error?: string };
      if (!init.ok || !started.upload) throw new Error(started.error || t("Could not start upload.", "تعذّر بدء رفع الملف."));
      const put = await fetch(started.upload.url, { method: started.upload.method, headers: started.upload.headers, body: file });
      if (!put.ok) throw new Error(t("Cloudflare R2 rejected the upload.", "رفضت Cloudflare R2 عملية الرفع."));
      const finish = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId: started.attachment.id })
      });
      const result = await finish.json() as { error?: string };
      if (!finish.ok) throw new Error(result.error || t("The attachment could not pass security scanning.", "تعذّر اجتياز المرفق فحص الأمان."));
      setFile(null);
      await load();
      toast.success(t("Attachment uploaded and passed security scanning.", "تم رفع المرفق واجتاز فحص الأمان."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("Attachment upload failed.", "فشل رفع المرفق.");
      setError(message);
      toast.error(message);
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-white px-5 py-5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
          <Link href="/account/support" className="text-sm">{t("All support requests", "جميع طلبات الدعم")}</Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-5 sm:py-10">
        {loading ? <div aria-label={t("Loading ticket", "جارٍ تحميل التذكرة")} className="h-40 animate-pulse rounded-2xl bg-[var(--color-ivory-100)]" /> : ticket && <>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{ticket.ticketNumber} · <StatusBadge locale={locale} status={ticket.status} /></p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{ticket.subject}</h1>
          <div className="mt-6 space-y-3">
            {ticket.messages.map(message => <article key={message.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex justify-between gap-3"><span className="text-sm font-semibold">{message.author}</span><time className="text-xs text-[var(--muted)]">{new Date(message.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")}</time></div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
            </article>)}
          </div>
          {ticket.attachments?.length > 0 && <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold">{t("Attachments", "المرفقات")}</h2>
            <ul className="mt-3 space-y-2">{ticket.attachments.map(attachment => <li key={attachment.id}>
              <a href={attachment.downloadUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-forest-900)] underline">{attachment.fileName}</a>
              <span className="ml-2 text-xs text-[var(--muted)]">{Math.ceil(attachment.sizeBytes / 1024)} {t("KB", "ك.ب")}</span>
            </li>)}</ul>
          </section>}
          {ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" ? <form onSubmit={submit} className="mt-6 rounded-2xl bg-white p-5">
            <label className="block text-sm font-semibold">{t("Reply", "الرد")}<textarea required minLength={2} maxLength={8000} rows={4} value={body} onChange={event => setBody(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] p-3" /></label>
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <label className="block text-sm font-semibold">{t("Add attachment", "إضافة مرفق")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /></label>
              <p className="mt-1 text-xs text-[var(--muted)]">{t("Maximum 10 MB. Files are not available until the malware scan passes.", "الحد الأقصى ١٠ ميغابايت. لن تتاح الملفات حتى اجتياز فحص البرمجيات الضارة.")}</p>
              <button type="button" disabled={!file || uploadBusy} onClick={upload} className="mt-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">{uploadBusy ? t("Uploading and scanning…", "جارٍ الرفع والفحص…") : t("Upload attachment", "رفع المرفق")}</button>
            </div>
            <button disabled={busy || body.trim().length < 2} className="mt-4 rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("Sending…", "جارٍ الإرسال…") : t("Send reply", "إرسال الرد")}</button>
          </form> : <p className="mt-6 rounded-xl bg-[var(--color-ivory-100)] p-4 text-sm">{t("This ticket is resolved or closed. Create a new request if you need more help.", "تم حل هذه التذكرة أو إغلاقها. أنشئ طلبًا جديدًا إذا احتجت إلى مزيد من المساعدة.")}</p>}
        </>}
        {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      </div>
    </main>
  );
}
