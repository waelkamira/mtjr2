"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Permission = { key: string; description: string | null };
type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  assignmentCount: number;
};
type Catalog = {
  roles: Role[];
  permissions: Array<Permission & { roleCount: number }>;
  generatedAt: string;
};

export default function PlatformAccessCatalogPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/control-panel/access-catalog", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Catalog & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load access catalogue.");
        if (active) setCatalog(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load access catalogue.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/control-panel" className="text-sm font-medium text-[var(--color-copper-600)] hover:underline">← Platform control panel</Link>
        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-copper-600)]">Security & governance</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">Roles & permissions</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Read-only inventory of platform roles, permission grants and current assignment counts. Changes remain disabled until a separately audited approval workflow is implemented.</p>
        </header>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading && <p role="status" className="mt-6 rounded-xl border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">Loading access catalogue…</p>}
        {catalog && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-xs text-[var(--muted)]">Defined roles</p><p className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{catalog.roles.length}</p></div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-xs text-[var(--muted)]">Permission keys</p><p className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{catalog.permissions.length}</p></div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><p className="text-xs text-[var(--muted)]">Role assignments</p><p className="mt-2 text-3xl font-semibold text-[var(--color-forest-950)]">{catalog.roles.reduce((sum, role) => sum + role.assignmentCount, 0)}</p></div>
            </div>

            <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5"><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">Role catalogue</h2><p className="mt-1 text-xs text-[var(--muted)]">System roles are marked; permission keys are listed exactly as stored.</p></div>
              <div className="divide-y divide-[var(--border)]">
                {catalog.roles.map((role) => (
                  <article key={role.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-forest-950)]">{role.name}</h3><code className="rounded bg-[var(--color-ivory-100)] px-2 py-1 text-xs">{role.key}</code>{role.isSystem && <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">System</span>}</div>{role.description && <p className="mt-2 text-sm text-[var(--muted)]">{role.description}</p>}</div>
                      <span className="text-xs text-[var(--muted)]">{role.assignmentCount} assignments</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {role.permissions.length ? role.permissions.map((permission) => <span key={permission.key} title={permission.description || undefined} className="rounded-lg border border-[var(--border)] bg-[var(--color-ivory-100)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--color-forest-950)]">{permission.key}</span>) : <span className="text-xs text-[var(--muted)]">No permissions assigned</span>}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-7 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5"><h2 className="text-lg font-semibold text-[var(--color-forest-950)]">Permission catalogue</h2><p className="mt-1 text-xs text-[var(--muted)]">Number of roles containing each permission.</p></div>
              <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
                {catalog.permissions.map((permission) => <article key={permission.key} className="bg-white p-4"><code className="text-xs font-semibold text-[var(--color-forest-950)]">{permission.key}</code><p className="mt-1 text-xs text-[var(--muted)]">{permission.description || "No description"}</p><p className="mt-2 text-[11px] text-[var(--muted)]">Used by {permission.roleCount} roles</p></article>)}
              </div>
            </section>
            <p className="mt-4 text-xs text-[var(--muted)]">Snapshot generated {new Date(catalog.generatedAt).toLocaleString()}. This page is read-only; role mutations are intentionally unavailable here.</p>
          </>
        )}
      </div>
    </main>
  );
}
