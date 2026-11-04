"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
type Suggestions = { products: Array<{ id: string; name: string; slug: string; storeName: string }>; stores: Array<{ id: string; name: string; slug: string }> };
export default function MarketplaceSearchBox() {
  const router=useRouter();
  const [query,setQuery]=useState(""); const [suggestions,setSuggestions]=useState<Suggestions>({products:[],stores:[]});
  const [open,setOpen]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const value=query.trim();if(value.length<2)return;
    const controller=new AbortController();const timer=window.setTimeout(async()=>{setLoading(true);setError("");setSuggestions({products:[],stores:[]});
      try{const response=await fetch(`/api/search/suggestions?q=${encodeURIComponent(value)}`,{signal:controller.signal});const body=await response.json() as Suggestions & {error?:string};if(!response.ok)throw new Error(body.error??"Suggestions are unavailable.");setSuggestions(body);setOpen(true);}
      catch(cause){if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"Suggestions are unavailable.");setSuggestions({products:[],stores:[]});}}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },250);return()=>{window.clearTimeout(timer);controller.abort();};
  },[query]);
  useEffect(()=>{function close(event:PointerEvent){if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);}document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[]);
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const params=new URLSearchParams();if(query.trim())params.set("q",query.trim().slice(0,120));const suffix=params.toString();setOpen(false);router.push(`/search${suffix?`?${suffix}`:""}`);}
  const hasResults=suggestions.products.length>0||suggestions.stores.length>0;
  return <div ref={root} className="relative order-3 w-full min-w-0 sm:order-none sm:ml-3 sm:max-w-xl sm:flex-1">
    <form onSubmit={submit} role="search" className="flex overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      <label htmlFor="site-search" className="sr-only">Search products and stores</label>
      <input id="site-search" role="combobox" aria-autocomplete="list" aria-expanded={open&&hasResults} aria-controls="site-search-suggestions" autoComplete="off" maxLength={120} value={query} onFocus={()=>setOpen(true)} onChange={e=>setQuery(e.target.value)} placeholder="Search products, brands, stores and more" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm outline-none"/>
      <button type="submit" className="bg-[var(--color-forest-800)] px-4 text-sm font-medium text-white transition hover:bg-[var(--color-forest-950)]">Search</button>

    </form>
    {open&&query.trim().length>=2&&<div id="site-search-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-3 shadow-xl">
      {loading&&<p className="px-3 py-2 text-xs text-[var(--muted)]">Searching…</p>}{error&&<p role="alert" className="px-3 py-2 text-xs text-red-700">{error}</p>}
      {!loading&&!error&&!hasResults&&<p className="px-3 py-2 text-xs text-[var(--muted)]">No suggestions. Press Search to view matching results.</p>}
      {suggestions.products.length>0&&<div><p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Products</p>{suggestions.products.map(item=><Link key={item.id} role="option" href={`/products/${encodeURIComponent(item.slug)}`} onClick={()=>setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--color-sage-100)]"><span className="block font-medium text-[var(--color-forest-950)]">{item.name}</span><span className="text-xs text-[var(--muted)]">Sold by {item.storeName}</span></Link>)}</div>}
      {suggestions.stores.length>0&&<div className="mt-2 border-t border-[var(--border)] pt-2"><p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Stores</p>{suggestions.stores.map(item=><Link key={item.id} role="option" href={`/stores/${encodeURIComponent(item.slug)}`} onClick={()=>setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--color-sage-100)]">{item.name}</Link>)}</div>}

    </div>}
  </div>;
}
