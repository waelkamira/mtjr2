"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Row = { id: string; subject: string; customerName: string; unread: boolean };
type Conv = {
  subject: string;
  customer: { email: string; displayName: string | null };
  messages: { id: string; body: string; author: string }[];
};

export default function Page() {
  const { locale } = useLocale();
  const [store, setStore] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [id, setId] = useState("");
  const [conversation, setConversation] = useState<Conv | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const activeStoreId = localStorage.getItem("mtjr.activeStoreId") || "";
    void Promise.resolve().then(() => setStore(activeStoreId));
  }, []);
  useEffect(() => {
    if (store) fetch("/api/stores/" + store + "/messages", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRows(data.items || []);
      if (data.items?.[0]) setId(data.items[0].id);
    }).catch((cause) => setError(cause.message));
  }, [store]);
  useEffect(() => {
    if (store && id) fetch("/api/stores/" + store + "/messages/" + id, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setConversation(data.conversation);
    }).catch((cause) => setError(cause.message));
  }, [store, id]);
  async function send(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/stores/" + store + "/messages/" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error); return; }
    setBody("");
    const refreshed = await fetch("/api/stores/" + store + "/messages/" + id);
    setConversation((await refreshed.json()).conversation);
  }

  return <main className="mx-auto max-w-6xl p-8">
    <Link href="/seller">{translate(locale, "Seller workspace", "مساحة عمل البائع")}</Link>
    <h1 className="my-6 text-3xl font-semibold">{translate(locale, "Store inbox", "صندوق وارد المتجر")}</h1>
    {!store && <p>{translate(locale, "Select a store in your seller workspace first.", "اختر متجرًا من مساحة عمل البائع أولًا.")}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="grid gap-6 md:grid-cols-[300px_1fr]">
      <aside>{rows.map((row) => <button key={row.id} onClick={() => setId(row.id)} className="mb-2 block w-full rounded-xl border bg-white p-4 text-left">
        <b>{row.customerName}</b><p>{row.subject}</p>
        <small>{row.unread ? translate(locale, "Unread", "غير مقروءة") : translate(locale, "Read", "مقروءة")}</small>
      </button>)}</aside>
      <section>{conversation && <>
        <h2 className="font-semibold">{conversation.subject} · {conversation.customer.displayName || conversation.customer.email}</h2>
        {conversation.messages.map((message) => <article key={message.id} className="my-3 rounded-xl border bg-white p-4">
          <b>{message.author}</b><p>{message.body}</p>
        </article>)}
        <form onSubmit={send}>
          <textarea required minLength={2} maxLength={8000} value={body} onChange={(event) => setBody(event.target.value)} className="w-full rounded-xl border p-3" />
          <button className="mt-2 rounded-lg bg-[var(--color-forest-900)] px-5 py-3 text-white">{translate(locale, "Reply", "رد")}</button>
        </form>
      </>}</section>
    </div>
  </main>;
}