"use client";

import { useId } from "react";
import { useLocale } from "@/components/locale-provider";
import { translate } from "@/lib/locale";

export type MetricChartRow = { label: string; value: number; color: string };
type Variant = "bar" | "donut" | "line" | "area" | "gauge";

const palette = ["#438fb4", "#69b5b0", "#9185b8", "#d2bd7d", "#78a8c6", "#527f96", "#c58ca5", "#8ab39a"];

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

function donutSegments(rows: MetricChartRow[]) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  if (!total) return [];
  let angle = 0;
  return rows.filter((row) => row.value > 0).map((row, index) => {
    const sweep = row.value / total * 359.2;
    const start = polar(90, 90, 68, angle);
    const end = polar(90, 90, 68, angle + sweep);
    const large = sweep > 180 ? 1 : 0;
    const path = `M ${start[0]} ${start[1]} A 68 68 0 ${large} 1 ${end[0]} ${end[1]}`;
    const segment = { path, color: palette[rows.indexOf(row) % palette.length], row, percent: Math.round(row.value / total * 100) };
    angle += sweep + 0.8;
    return segment;
  });
}

export default function MetricBarChart({ title, rows, description, variant = "bar", centerLabel }: {
  title: string;
  rows: MetricChartRow[];
  description?: string;
  variant?: Variant;
  centerLabel?: string;
}) {
  const { locale } = useLocale();
  const chartId = useId().replaceAll(":", "");
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  const segments = donutSegments(rows);
  const points = rows.map((row, index) => ({
    x: rows.length < 2 ? 180 : 18 + index * (324 / (rows.length - 1)),
    y: 116 - (Math.max(0, row.value) / maximum) * 92
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `18,124 ${line} 342,124` : "";
  const gaugePercent = Math.min(100, Math.max(0, total ? rows[0]?.value ?? 0 : 0));
  const gaugeAngle = 270 + gaugePercent * 1.8;
  const gaugeEnd = polar(170, 150, 112, gaugeAngle);

  return (
    <article className="group min-w-0 rounded-[1.7rem] border border-white/90 bg-[linear-gradient(145deg,#f1f7f8,#dce9ed)] p-5 shadow-[0_9px_22px_rgba(35,62,81,.1),inset_0_2px_0_white,inset_0_-2px_6px_rgba(48,76,94,.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(35,62,81,.14),inset_0_2px_0_white]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-[#344d60]">{translate(locale, title, title)}</h3>
          {description && <p className="mt-1 text-xs leading-5 text-[#526477]">{translate(locale, description, description)}</p>}
        </div>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-[#8fc9c8] to-[#5d9fb5] shadow-[0_0_0_4px_rgba(89,157,174,.14)]" />
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white/55 p-5 text-xs text-[#526477]">{translate(locale, "No analytics data is available for this view yet.", "لا تتوفر بيانات إحصائية لهذا العرض حتى الآن.")}</p>
      ) : <>
        {variant === "donut" && <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <svg viewBox="0 0 180 180" role="img" aria-label={title} className="h-full w-full -rotate-0">
              <circle cx="90" cy="90" r="68" fill="none" stroke="#d9e7eb" strokeWidth="17" />
              {segments.map((segment, index) => <path key={index} d={segment.path} fill="none" stroke={segment.color} strokeWidth="17" strokeLinecap="round" />)}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-2xl font-black tabular-nums text-slate-800">{total.toLocaleString(locale)}</strong>
              <span className="mt-1 text-[10px] font-medium text-[#526477]">{translate(locale, centerLabel || "Total", centerLabel || "الإجمالي")}</span>
            </div>
          </div>
          <div className="w-full space-y-2.5">
            {rows.map((row, index) => <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-[#688394]"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} /><span className="truncate">{translate(locale, row.label, row.label)}</span></span>
              <strong className="shrink-0 tabular-nums text-[#405a6d]">{row.value.toLocaleString(locale)}</strong>
            </div>)}
          </div>
        </div>}

        {(variant === "line" || variant === "area") && <div className="mt-4">
          <div className="mb-2 flex items-end justify-between"><strong className="text-2xl font-black tabular-nums text-slate-800">{total.toLocaleString(locale)}</strong><span className="text-[10px] text-[#526477]">{translate(locale, "Across selected period", "خلال الفترة المحددة")}</span></div>
          <svg viewBox="0 0 360 132" className="h-36 w-full overflow-visible" role="img" aria-label={title}>
            {[30, 60, 90, 120].map((y) => <line key={y} x1="12" x2="348" y1={y} y2={y} stroke="#d6e4e9" strokeDasharray="3 5" />)}
            {variant === "area" && <polygon points={area} fill={`url(#analyticsArea-${chartId})`} />}
            <defs><linearGradient id={`analyticsArea-${chartId}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#69b5b0" stopOpacity=".28" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs>
            <polyline points={line} fill="none" stroke={variant === "area" ? "#69b5b0" : "#438fb4"} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill="white" stroke={palette[index % palette.length]} strokeWidth="2.5" />)}
          </svg>
          <div className="mt-1 flex justify-between gap-2 text-[10px] text-[#526477]">{rows.map((row) => <span key={row.label} className="min-w-0 truncate">{translate(locale, row.label, row.label)}</span>)}</div>
        </div>}

        {variant === "gauge" && <div className="relative mx-auto mt-3 h-36 max-w-xs overflow-hidden">
          <svg viewBox="0 0 340 180" className="h-full w-full" role="img" aria-label={title}>
            <path d="M 58 150 A 112 112 0 0 0 282 150" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
            <path d={`M 58 150 A 112 112 0 0 0 ${gaugeEnd[0]} ${gaugeEnd[1]}`} fill="none" stroke={`url(#gaugeGradient-${chartId})`} strokeWidth="20" strokeLinecap="round" />
            <defs><linearGradient id={`gaugeGradient-${chartId}`}><stop stopColor="#69b5b0" /><stop offset="100%" stopColor="#438fb4" /></linearGradient></defs>
            <text x="170" y="122" textAnchor="middle" className="fill-slate-800 text-4xl font-black">{gaugePercent}%</text>
            <text x="170" y="145" textAnchor="middle" className="fill-slate-400 text-xs">{translate(locale, rows[0]?.label || "Progress", rows[0]?.label || "التقدم")}</text>
          </svg>
        </div>}

        {variant === "bar" && <div className="mt-5 space-y-4">
          {rows.map((row, index) => <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-[#526477]"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} /><span className="truncate">{translate(locale, row.label, row.label)}</span></span>
              <strong className="tabular-nums text-slate-700">{row.value.toLocaleString(locale)}</strong>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${row.value > 0 ? Math.max(2, row.value / maximum * 100) : 0}%`, background: `linear-gradient(90deg, ${palette[index % palette.length]}, ${palette[(index + 1) % palette.length]})` }} />
            </div>
          </div>)}
        </div>}
      </>}
    </article>
  );
}
