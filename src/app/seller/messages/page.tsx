"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Store = { id: string; name: string };
type Row = { id: string; subject: string; customerName: string; unread: boolean };
type Conv = {
  subject: string;
  customer: { email: string; displayName: string | null };
  messages: { id: string; body: string; author: string }[];
};

export default function Page() {
  const { locale } = useLocale();
  const [store, setStore] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [id, setId] = useState("");
  const [conversation, setConversation] = useState<Conv | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/seller/stores", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { stores?: Store[]; error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر."));
      if (!active) return;
      const available = data.stores ?? [];
      setStores(available);
      let saved = "";
      try { saved = localStorage.getItem("mtjr.activeStoreId") || ""; } catch { /* Messaging remains available when browser storage is blocked. */ }
      const selected = available.some((item) => item.id === saved) ? saved : available[0]?.id ?? "";
      setStore(selected);
      if (selected) { try { localStorage.setItem("mtjr.activeStoreId", selected); window.dispatchEvent(new Event("mtjr:active-store-changed")); } catch { /* Store selection remains available for this session. */ } }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the previous store inbox before loading the selected store.
    setRows([]);
    setId("");
    setConversation(null);
    setError("");
    if (!store) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the inbox loading state when there is no active store.
      setLoadingInbox(false);
      return () => { active = false; };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the inbox loading state before the store query starts.
    setLoadingInbox(true);
    fetch("/api/stores/" + store + "/messages", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (!active) return;
      setRows(data.items || []);
      if (data.items?.[0]) setId(data.items[0].id);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load conversations.", "تعذر تحميل المحادثات.")); })
      .finally(() => { if (active) setLoadingInbox(false); });
    return () => { active = false; };
  }, [store, locale]);
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid showing the previous conversation while the selected thread loads.
    setConversation(null);
    setError("");
    if (!store || !id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the conversation loading state when no thread is selected.
      setLoadingConversation(false);
      return () => { active = false; };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the conversation loading state before the thread query starts.
    setLoadingConversation(true);
    fetch("/api/stores/" + store + "/messages/" + id, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (active) setConversation(data.conversation);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load conversation.", "تعذر تحميل المحادثة.")); })
      .finally(() => { if (active) setLoadingConversation(false); });
    return () => { active = false; };
  }, [store, id, locale]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || sending || !store || !id) return;
    const targetStore = store;
    const targetId = id;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/stores/" + targetStore + "/messages/" + targetId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || translate(locale, "Message could not be sent.", "تعذر إرسال الرسالة."));
      if (store !== targetStore || id !== targetId) return;
      setBody("");
      const refreshed = await fetch("/api/stores/" + targetStore + "/messages/" + targetId, { cache: "no-store" });
      const refreshedData = await refreshed.json() as { conversation?: Conv; error?: string };
      if (!refreshed.ok || !refreshedData.conversation) throw new Error(refreshedData.error || translate(locale, "Message was sent, but the conversation could not be refreshed.", "تم إرسال الرسالة، لكن تعذر تحديث المحادثة."));
      if (store === targetStore && id === targetId) setConversation(refreshedData.conversation);
    } catch (cause) {
      if (store === targetStore && id === targetId) setError(cause instanceof Error ? cause.message : translate(locale, "Message could not be sent.", "تعذر إرسال الرسالة."));
    } finally {
      setSending(false);
    }
  }

  return <main className="min-h-screen bg-transparent px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#a94308]">{translate(locale,"CUSTOMER OPERATIONS","عمليات العملاء")}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[#454545]">{translate(locale, "Store inbox", "صندوق وارد المتجر")}</h1><p className="mt-2 text-sm text-[#77716c]">{translate(locale,"Respond to customer conversations from your store workspace.","تابع محادثات العملاء ورد عليها من مساحة متجرك.")}</p></div>
        <label className="grid gap-1 text-xs font-bold text-[#5f5a55]">{translate(locale,"Active store","المتجر النشط")}<select value={store} onChange={(event)=>{setStore(event.target.value);setId("");setRows([]);setConversation(null);setError("");setBody("");try{localStorage.setItem("mtjr.activeStoreId", event.target.value); window.dispatchEvent(new Event("mtjr:active-store-changed"));}catch{/* Store selection remains available for this session. */}}} disabled={loading || !stores.length} className="min-w-0 w-full rounded-2xl sm:min-w-[220px] border border-[#eee9e4] bg-white px-4 py-3 text-sm text-[#454545] shadow-[inset_0_2px_6px_rgba(119,86,62,.06),0_1px_0_white]">{stores.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </header>
      {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,.38fr)_minmax(0,1fr)]">
        <aside className="max-h-[280px] overflow-y-auto rounded-[1.8rem] border border-[#eee9e4] bg-white p-4 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white] lg:max-h-none lg:overflow-visible">
          <h2 className="mb-3 px-2 text-sm font-extrabold text-[#454545]">{translate(locale,"Conversations","المحادثات")} <span className="ms-1 text-xs text-[#77716c]">({rows.length})</span></h2>
          {loading || loadingInbox ? <p className="p-4 text-sm text-[#77716c]">{translate(locale,"Loading inbox…","جارٍ تحميل الرسائل...")}</p> : rows.length ? rows.map((row) => <button key={row.id} onClick={() => setId(row.id)} aria-pressed={id===row.id} className={id===row.id?"mb-2 block w-full rounded-2xl border border-transparent bg-[#FF8C1C] p-4 text-start text-white shadow-none":"mb-2 block w-full rounded-2xl border border-white/70 bg-white/45 p-4 text-start text-[#5f5a55] transition hover:bg-white/75"}><div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{row.customerName}</b>{row.unread&&<span className="size-2 shrink-0 rounded-full bg-[#FF8C1C]"/>}</div><p className="mt-1 truncate text-xs">{row.subject}</p><small className={`mt-2 block text-[10px] ${id===row.id ? "text-white/90" : "text-[#77716c]"}`}>{row.unread ? translate(locale, "Unread", "غير مقروءة") : translate(locale, "Read", "مقروءة")}</small></button>) : <p className="rounded-xl bg-white/50 p-4 text-sm text-[#77716c]">{translate(locale,"No conversations for this store yet.","لا توجد محادثات لهذا المتجر بعد.")}</p>}
        </aside>
        <section className="min-h-[480px] rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#fffaf6,#f5eee7)] p-5 shadow-[0_14px_30px_rgba(119,86,62,.08),inset_0_2px_0_white] sm:p-6">
          {loadingConversation ? <p role="status" className="grid min-h-[420px] place-items-center text-sm text-[#77716c]">{translate(locale,"Loading conversation…","جارٍ تحميل المحادثة…")}</p> : conversation ? <>
            <div className="border-b border-[#eee9e4] pb-4"><p className="text-[10px] font-extrabold tracking-[.15em] text-[#77716c]">{translate(locale,"CUSTOMER CONVERSATION","محادثة عميل")}</p><h2 className="mt-1 text-lg font-black text-[#454545]">{conversation.subject}</h2><p className="mt-1 text-xs text-[#77716c]">{conversation.customer.displayName || conversation.customer.email}</p></div>
            <div className="max-h-[520px] space-y-3 overflow-y-auto py-5">{conversation.messages.map((message) => <article key={message.id} className="max-w-[88%] rounded-2xl border border-[#eee9e4] bg-[#fffaf6] p-4 text-[#454545] shadow-[0_5px_13px_rgba(119,86,62,.05),inset_0_1px_0_white]"><b className="text-xs">{translate(locale, message.author.toLowerCase().replaceAll("_", " "), ({ CUSTOMER: "العميل", SELLER: "البائع", STAFF: "فريق المتجر" } as Record<string, string>)[message.author] ?? message.author)}</b><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p></article>)}</div>
            <form onSubmit={send} className="border-t border-[#eee9e4] pt-4"><textarea required minLength={2} maxLength={8000} disabled={sending} value={body} onChange={(event) => setBody(event.target.value)} placeholder={translate(locale,"Write a helpful reply…","اكتب رداً مناسباً...")} className="w-full rounded-2xl border border-white bg-[linear-gradient(145deg,#fffdfb,#f5eee7)] p-4 text-sm text-[#454545] shadow-[inset_0_3px_7px_rgba(119,86,62,.06)] outline-none focus:border-[#FF8C1C] focus:ring-2 focus:ring-[#FF8C1C]/15"/><button disabled={sending || body.trim().length < 2} className="mt-3 rounded-full border border-[#FF8C1C] bg-[#FF8C1C] px-6 py-3 text-sm font-extrabold text-white shadow-[0_6px_14px_rgba(255,140,28,.18)] transition hover:border-[#E8750B] hover:bg-[#E8750B] disabled:cursor-not-allowed disabled:opacity-50">{sending ? translate(locale, "Sending…", "جارٍ الإرسال…") : translate(locale, "Send reply", "إرسال الرد")}</button></form>
          </> : <div className="grid min-h-[420px] place-items-center text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#fff1e8] text-3xl text-[#FF8C1C] shadow-[0_8px_18px_rgba(119,86,62,.08),inset_0_1px_0_white]">✉</span><h2 className="mt-4 font-extrabold text-[#454545]">{translate(locale,"Select a conversation","اختر محادثة")}</h2><p className="mt-1 text-sm text-[#77716c]">{translate(locale,"Choose a customer from the list to view messages and reply.","اختر عميلاً من القائمة لعرض الرسائل والرد عليه.")}</p></div></div>}
        </section>
      </div>
    </div>
  </main>;
}