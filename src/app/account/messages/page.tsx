"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Row = { id: string; subject: string; lastMessageAt: string; store: { name: string }; messageCount: number; unread: boolean };

export default function MessagesPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/messages", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || translate(locale, "Messages could not be loaded.", "تعذّر تحميل الرسائل."));
        if (active) setItems(data.items || []);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Messages could not be loaded.", "تعذّر تحميل الرسائل."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  return <main className="mx-auto max-w-5xl p-8">
    <Link href="/" aria-label="mtjr">mtjr.</Link>
    <h1 className="my-6 text-3xl font-semibold">{t("Messages with stores", "الرسائل مع المتاجر")}</h1>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">{t("Loading messages…", "جارٍ تحميل الرسائل…")}</p> : items.map(item =>
      <Link key={item.id} href={`/account/messages/${item.id}`} className="mb-3 block rounded-xl border bg-[var(--surface)] p-5">
        <b>{item.store.name}</b>
        <p>{item.subject}</p>
        <small>{item.unread ? t("Unread", "غير مقروءة") : t("Read", "مقروءة")} · {item.messageCount} {t("messages", "رسائل")}</small>
      </Link>
    )}
    {!loading && !items.length && !error && <p>{t("No conversations yet. Start one from a store or product page.", "لا توجد محادثات بعد. ابدأ محادثة من صفحة متجر أو منتج.")}</p>}
  </main>;
}
