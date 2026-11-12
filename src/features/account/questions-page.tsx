"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";
import { StatusBadge } from "@/components/status-badge";

type Item = { id: string; question: string; status: string; createdAt: string; product: { name: string; slug: string }; answers: Array<{ id: string; body: string; status: string; createdAt: string; author: string }> };

export default function AccountQuestionsPage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [items,setItems]=useState<Item[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{let active=true;fetch("/api/account/questions",{cache:"no-store"}).then(async r=>{const d=await r.json() as {items?:Item[];error?:string};if(!r.ok)throw new Error(d.error||translate(locale,"Questions unavailable.","الأسئلة غير متاحة."));if(active)setItems(d.items||[]);}).catch(e=>{if(active)setError(e instanceof Error?e.message:translate(locale,"Questions unavailable.","الأسئلة غير متاحة."));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[locale]);
  return <main className="min-h-screen bg-[var(--background)]"><header className="border-b border-[var(--border)] bg-white px-5 py-5"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3"><Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link><Link href="/account/orders" className="text-sm">{t("My orders","طلباتي")}</Link></div></header><div className="mx-auto max-w-4xl px-5 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">{t("Your activity","نشاطك")}</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{t("My product questions","أسئلتي حول المنتجات")}</h1>{error&&<p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}{loading?<div aria-label={t("Loading questions","جارٍ تحميل الأسئلة")} className="mt-6 h-40 animate-pulse rounded-3xl bg-[var(--color-ivory-100)]"/>:items.length?<div className="mt-6 space-y-4">{items.map(item=><article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><Link href={`/products/${encodeURIComponent(item.product.slug)}`} className="font-semibold underline">{item.product.name}</Link><StatusBadge locale={locale} status={item.status} /></div><p className="mt-3 text-sm font-medium">{t("Q:","س:")} {item.question}</p>{item.answers.filter(a=>a.status==="PUBLISHED").map(a=><p key={a.id} className="mt-3 border-l-2 border-[var(--color-copper-600)] pl-3 text-sm text-[var(--muted)]">{t("A:","ج:")} {a.body}</p>)}<p className="mt-3 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleDateString(locale==="ar"?"ar":"en")}</p></article>)}</div>:!error?<p className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">{t("You have not asked any product questions yet.","لم تطرح أي أسئلة حول المنتجات بعد.")}</p>:null}</div></main>;
}
