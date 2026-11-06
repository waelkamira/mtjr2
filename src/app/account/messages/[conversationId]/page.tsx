"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Message = { id: string; body: string; createdAt: string; author: string };
type Conversation = { subject: string; storeName: string; messages: Message[] };

export default function MessageThreadPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [id, setId] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    params.then(value => { if (active) setId(value.conversationId); });
    return () => { active = false; };
  }, [params]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch(`/api/messages/${id}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || translate(locale, "Conversation could not be loaded.", "تعذّر تحميل المحادثة."));
        if (active) setConversation(data.conversation);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Conversation could not be loaded.", "تعذّر تحميل المحادثة."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, locale]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || t("Message could not be sent.", "تعذّر إرسال الرسالة."));
      return;
    }
    setBody("");
    const refreshed = await fetch(`/api/messages/${id}`, { cache: "no-store" });
    const result = await refreshed.json();
    if (!refreshed.ok) {
      setError(result.error || t("Conversation could not be refreshed.", "تعذّر تحديث المحادثة."));
      return;
    }
    setConversation(result.conversation);
  }

  return <main className="mx-auto max-w-4xl p-8">
    <Link href="/account/messages">← {t("Inbox", "صندوق الوارد")}</Link>
    {loading && <p role="status" className="mt-6">{t("Loading conversation…", "جارٍ تحميل المحادثة…")}</p>}
    {conversation && <>
      <p className="mt-6 text-sm">{conversation.storeName}</p>
      <h1 className="text-3xl font-semibold">{conversation.subject}</h1>
      <div className="my-6 space-y-3">{conversation.messages.map(message =>
        <article key={message.id} className="rounded-xl border bg-[var(--surface)] p-4">
          <b>{message.author}</b>
          <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
        </article>
      )}</div>
      <form onSubmit={send}>
        <textarea aria-label={t("Message", "الرسالة")} required minLength={2} maxLength={8000} value={body} onChange={event => setBody(event.target.value)} className="w-full rounded-xl border p-3" />
        <button className="mt-2 rounded-lg bg-[var(--color-ink-800)] px-5 py-3 text-white">{t("Send message", "إرسال الرسالة")}</button>
      </form>
    </>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
