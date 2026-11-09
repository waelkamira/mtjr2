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
      if (selected) { try { localStorage.setItem("mtjr.activeStoreId", selected); } catch { /* Store selection remains available for this session. */ } }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : translate(locale, "Unable to load stores.", "تعذر تحميل المتاجر.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);
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

  return <main className="min-h-screen bg-transparent px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#628493]">{translate(locale,"CUSTOMER OPERATIONS","عمليات العملاء")}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[#263d50]">{translate(locale, "Store inbox", "صندوق وارد المتجر")}</h1><p className="mt-2 text-sm text-[#647d8d]">{translate(locale,"Respond to customer conversations from your store workspace.","تابع محادثات العملاء ورد عليها من مساحة متجرك.")}</p></div>
        <label className="grid gap-1 text-xs font-bold text-[#557184]">{translate(locale,"Active store","المتجر النشط")}<select value={store} onChange={(event)=>{setStore(event.target.value);setId("");setRows([]);setConversation(null);setError("");try{localStorage.setItem("mtjr.activeStoreId",event.target.value);}catch{/* Store selection remains available for this session. */}}} disabled={loading || !stores.length} className="min-w-[220px] rounded-2xl border border-white bg-[linear-gradient(145deg,#f7fbfc,#e4eef2)] px-4 py-3 text-sm text-[#29475b] shadow-[inset_0_2px_6px_rgba(43,69,88,.1),0_1px_0_white]">{stores.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </header>
      {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,.38fr)_minmax(0,1fr)]">
        <aside className="rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#eaf3f6,#d3e2e8)] p-4 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white]">
          <h2 className="mb-3 px-2 text-sm font-extrabold text-[#304e63]">{translate(locale,"Conversations","المحادثات")} <span className="ms-1 text-xs text-[#718a99]">({rows.length})</span></h2>
          {loading ? <p className="p-4 text-sm text-[#718a99]">{translate(locale,"Loading inbox…","جارٍ تحميل الرسائل...")}</p> : rows.length ? rows.map((row) => <button key={row.id} onClick={() => setId(row.id)} aria-pressed={id===row.id} className={id===row.id?"mb-2 block w-full rounded-2xl border border-white bg-[linear-gradient(145deg,#c8e1e6,#a8cbd4)] p-4 text-start text-[#29465b] shadow-[0_6px_14px_rgba(35,62,81,.12),inset_0_1px_0_white]":"mb-2 block w-full rounded-2xl border border-white/70 bg-white/45 p-4 text-start text-[#38566b] transition hover:bg-white/75"}><div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{row.customerName}</b>{row.unread&&<span className="size-2 shrink-0 rounded-full bg-[#4d9c9b]"/>}</div><p className="mt-1 truncate text-xs">{row.subject}</p><small className="mt-2 block text-[10px] text-[#718a99]">{row.unread ? translate(locale, "Unread", "غير مقروءة") : translate(locale, "Read", "مقروءة")}</small></button>) : <p className="rounded-xl bg-white/50 p-4 text-sm text-[#718a99]">{translate(locale,"No conversations for this store yet.","لا توجد محادثات لهذا المتجر بعد.")}</p>}
        </aside>
        <section className="min-h-[480px] rounded-[1.8rem] border border-white/85 bg-[linear-gradient(145deg,#edf5f7,#d5e4e9)] p-5 shadow-[0_14px_30px_rgba(35,62,81,.13),inset_0_2px_0_white] sm:p-6">
          {conversation ? <>
            <div className="border-b border-[#b8cbd4] pb-4"><p className="text-[10px] font-extrabold tracking-[.15em] text-[#718a99]">{translate(locale,"CUSTOMER CONVERSATION","محادثة عميل")}</p><h2 className="mt-1 text-lg font-black text-[#29465b]">{conversation.subject}</h2><p className="mt-1 text-xs text-[#718a99]">{conversation.customer.displayName || conversation.customer.email}</p></div>
            <div className="max-h-[520px] space-y-3 overflow-y-auto py-5">{conversation.messages.map((message) => <article key={message.id} className="max-w-[88%] rounded-2xl border border-white/80 bg-[linear-gradient(145deg,#f7fbfc,#e2edf1)] p-4 text-[#38566b] shadow-[0_5px_13px_rgba(35,62,81,.08),inset_0_1px_0_white]"><b className="text-xs">{message.author}</b><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p></article>)}</div>
            <form onSubmit={send} className="border-t border-[#b8cbd4] pt-4"><textarea required minLength={2} maxLength={8000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={translate(locale,"Write a helpful reply…","اكتب رداً مناسباً...")} className="w-full rounded-2xl border border-white bg-[linear-gradient(145deg,#f7fbfc,#e4eef2)] p-4 text-sm text-[#29465b] shadow-[inset_0_3px_7px_rgba(43,69,88,.1)] outline-none focus:ring-2 focus:ring-[#9bcbd0]/50"/><button className="mt-3 rounded-full border border-white bg-[linear-gradient(145deg,#9ed1cf,#6eafb2)] px-6 py-3 text-sm font-extrabold text-[#23485a] shadow-[0_6px_14px_rgba(38,94,105,.18),inset_0_1px_0_white]">{translate(locale, "Send reply", "إرسال الرد")}</button></form>
          </> : <div className="grid min-h-[420px] place-items-center text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#d3e5e9] text-3xl text-[#587d8e] shadow-[0_8px_18px_rgba(35,62,81,.12),inset_0_1px_0_white]">✉</span><h2 className="mt-4 font-extrabold text-[#304e63]">{translate(locale,"Select a conversation","اختر محادثة")}</h2><p className="mt-1 text-sm text-[#718a99]">{translate(locale,"Choose a customer from the list to view messages and reply.","اختر عميلاً من القائمة لعرض الرسائل والرد عليه.")}</p></div></div>}
        </section>
      </div>
    </div>
  </main>;
}