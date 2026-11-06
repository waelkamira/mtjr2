"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

type Profile = { id: string; email: string; displayName: string | null; status: string; createdAt: string };
export default function ProfilePage() {
  const { locale } = useLocale();
  const t = (english: string, arabic: string) => translate(locale, english, arabic);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{let active=true;fetch("/api/account/profile",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setProfile(d.profile);setName(d.profile.displayName||"");}}).catch(e=>{if(active)setError(e.message||translate(locale,"Unable to load profile.","تعذّر تحميل الملف الشخصي."));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;}},[locale]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/account/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName:name})});const d=await r.json();if(!r.ok)throw Error(d.error);setProfile(p=>p?{...p,...d.profile}:p);setNotice(t("Profile updated.","تم تحديث الملف الشخصي."));}catch(e){setError(e instanceof Error?e.message:t("Unable to update profile.","تعذّر تحديث الملف الشخصي."));}finally{setBusy(false);}}
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8"><div className="mx-auto max-w-3xl"><Link href="/account" className="text-sm text-[var(--color-ink-600)]">← {t("My account","حسابي")}</Link><h1 className="mt-5 text-3xl font-semibold text-[var(--color-ink-950)]">{t("Personal profile","الملف الشخصي")}</h1><p className="mt-2 text-sm text-[var(--muted)]">{t("Manage the details associated with your marketplace account.","أدر التفاصيل المرتبطة بحسابك في السوق.")}</p>{loading?<p className="mt-8">{t("Loading profile…","جارٍ تحميل الملف الشخصي…")}</p>:profile?<section className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">{error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mb-4 rounded-xl bg-[var(--color-sage-100)] p-3 text-sm">{notice}</p>}<form onSubmit={save} className="space-y-5"><label className="block text-sm font-medium">{t("Display name","الاسم المعروض")}<input className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3" value={name} onChange={e=>setName(e.target.value)} required minLength={1} maxLength={80}/></label><label className="block text-sm font-medium">{t("Email address","البريد الإلكتروني")}<input className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3" value={profile.email} readOnly/></label><div className="text-xs text-[var(--muted)]">{t("Account status:","حالة الحساب:")} {profile.status}</div><button disabled={busy} className="rounded-xl bg-[var(--color-ink-800)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?t("Saving…","جارٍ الحفظ…"):t("Save changes","حفظ التغييرات")}</button></form><div className="mt-8 border-t border-[var(--border)] pt-5"><Link href="/account/addresses" className="font-semibold text-[var(--color-ink-600)]">{t("Manage saved addresses →","إدارة العناوين المحفوظة ←")}</Link></div></section>:<p role="alert" className="mt-8">{error||t("Profile unavailable.","الملف الشخصي غير متاح.")}</p>}</div></main>;
}
