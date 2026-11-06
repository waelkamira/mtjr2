"use client";

import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export type MetricChartRow = { label: string; value: number; color: string };

export default function MetricBarChart({ title, rows, description }: {
  title: string;
  rows: MetricChartRow[];
  description?: string;
}) {
  const { locale } = useLocale();
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--color-forest-950)]">{translate(locale, title, title)}</h3>
      {description && <p className="mt-1 text-xs text-[var(--muted)]">{translate(locale, description, description)}</p>}
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-[var(--muted)]">{translate(locale, row.label, row.label)}</span>
              <strong className="tabular-nums text-[var(--color-forest-950)]">{row.value.toLocaleString(locale)}</strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-ivory-100)]">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.value > 0 ? Math.max(2, (row.value / maximum) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
