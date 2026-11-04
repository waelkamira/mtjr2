import Link from "next/link";

type Props = {
  action: string;
  query?: string;
  page: number;
  totalPages: number;
  label?: string;
  params?: Record<string,string>;
  sort?: "relevance" | "newest" | "name_asc" | "name_desc";

};

function pageHref(action: string, query: string, page: number, extra: Record<string,string> = {}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const [key,value] of Object.entries(extra)) if(value) params.set(key,value);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `${action}?${suffix}` : action;
}

export default function CatalogListControls({ action, query = "", page, totalPages, label = "Search", params = {}, sort }: Props) {

  return <div className="my-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <form action={action} method="get" role="search" className="flex w-full max-w-xl gap-2">
      <label className="sr-only" htmlFor={`catalog-search-${action.replace(/[^a-z0-9]/gi, "-")}`}>{label}</label>
      <input id={`catalog-search-${action.replace(/[^a-z0-9]/gi, "-")}`} name="q" type="search" maxLength={120} defaultValue={query} placeholder={label === "Search stores" ? "Search stores…" : "Search products…"} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm" />
      {Object.entries(params).map(([key, value]) => key !== "sort" || !sort ? <input key={key} type="hidden" name={key} value={value} /> : null)}
      {sort && <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Sort
        <select name="sort" defaultValue={sort} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)]">
          <option value="relevance" disabled={!query.trim()}>Relevance</option>
          <option value="newest">Newest</option>
          <option value="name_asc">Name: A–Z</option>
          <option value="name_desc">Name: Z–A</option>
        </select>
      </label>}
      <button type="submit" className="rounded-xl bg-[var(--color-forest-900)] px-4 py-2.5 text-sm font-semibold text-white">Search</button>
    </form>
    {totalPages > 1 && <nav aria-label="Pagination" className="flex items-center gap-3 text-sm">
      {page > 1 ? <Link rel="prev" href={pageHref(action, query, page - 1, { ...params, ...(sort ? { sort } : {}) })} className="rounded-lg border border-[var(--border)] px-3 py-2">Previous</Link> : <span aria-disabled="true" className="rounded-lg border border-[var(--border)] px-3 py-2 opacity-40">Previous</span>}
      <span className="whitespace-nowrap text-[var(--muted)]">Page {page} of {totalPages}</span>
      {page < totalPages ? <Link rel="next" href={pageHref(action, query, page + 1, { ...params, ...(sort ? { sort } : {}) })} className="rounded-lg border border-[var(--border)] px-3 py-2">Next</Link> : <span aria-disabled="true" className="rounded-lg border border-[var(--border)] px-3 py-2 opacity-40">Next</span>}

    </nav>}
  </div>;
}
