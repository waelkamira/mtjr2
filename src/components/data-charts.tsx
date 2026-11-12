import type { ReactNode } from "react";

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

export type ScatterDatum = {
  label: string;
  x: number;
  y: number;
  size?: number;
};

const palette = [
  "var(--orange)",
  "#8B5CF6",
  "#38BDF8",
  "#34D399",
  "#F472B6",
  "var(--orange)",
  "#22D3EE",
  "#A3E635"
];

export function chartColor(index: number) {
  return palette[index % palette.length];
}

function ChartCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="seller-chart-card min-w-0 overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white p-5 shadow-[0_8px_22px_rgba(69,69,69,.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d5d5d5] hover:shadow-[0_12px_28px_rgba(69,69,69,.09)]">
      <div className="mb-4">
        <div aria-hidden="true" className="mb-3 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,#FF8C1C_0%,#8B5CF6_35%,#38BDF8_68%,#34D399_100%)] shadow-[0_0_18px_rgba(56,189,248,.25)]" />
        <h2 className="text-base font-extrabold text-[#454545]">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-[#777777]">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ColumnChart({
  title,
  description,
  data,
  emptyLabel
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const width = Math.max(480, data.length * 38);
  return (
    <ChartCard title={title} description={description}>
      {data.length ? (
        <div className="overflow-x-auto">
          <svg role="img" aria-label={title} viewBox={`0 0 ${width} 190`} className="h-48 w-full min-w-[480px]" preserveAspectRatio="none">
            {[0, 1, 2, 3].map((line) => {
              const y = 12 + line * 42;
              return <line key={line} x1="30" x2={width - 4} y1={y} y2={y} stroke="#e7e7e7" strokeDasharray="3 4" />;
            })}
            {data.map((item, index) => {
              const barWidth = Math.max(4, Math.min(20, (width - 45) / data.length - 4));
              const x = 35 + index * ((width - 45) / data.length);
              const height = Math.max(item.value ? 3 : 0, (item.value / max) * 132);
              return (
                <g key={`${item.label}-${index}`}>
                  <title>{`${item.label}: ${item.value}`}</title>
                  <rect x={x} y={150 - height} width={barWidth} height={height} rx="4" fill={item.color ?? chartColor(index)} />
                </g>
              );
            })}
            <line x1="30" x2={width - 4} y1="150" y2="150" stroke="#b8b8b8" />
          </svg>
          <div className="mt-1 flex justify-between gap-2 text-[10px] text-[#777777]">
            <span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span>
          </div>
        </div>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

export function HorizontalBarChart({
  title,
  description,
  data,
  emptyLabel
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <ChartCard title={title} description={description}>
      {data.length ? (
        <div className="space-y-3" role="list" aria-label={title}>
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} role="listitem" className="grid grid-cols-[minmax(5rem,1fr)_2fr_auto] items-center gap-3 text-xs">
              <span className="truncate text-[#777777]" title={item.label}>{item.label}</span>
              <div className="h-3 overflow-hidden rounded-full border border-[#e8e8e8] bg-[#f5f5f5]">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (item.value / max) * 100)}%`, backgroundColor: item.color ?? chartColor(index) }} />
              </div>
              <span className="min-w-8 text-end font-semibold tabular-nums text-[#454545]">{item.value}</span>
            </div>
          ))}
        </div>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

export function LineAreaChart({
  title,
  description,
  data,
  area = true,
  emptyLabel
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  area?: boolean;
  emptyLabel?: string;
}) {
  const width = Math.max(480, data.length * 20);
  const max = Math.max(1, ...data.map((item) => item.value));
  const points = data.map((item, index) => ({
    x: data.length <= 1 ? width / 2 : 30 + (index * (width - 42)) / (data.length - 1),
    y: 145 - (item.value / max) * 120,
    item
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length
    ? `M ${points[0].x} 150 L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points.at(-1)?.x} 150 Z`
    : "";
  return (
    <ChartCard title={title} description={description}>
      {data.length ? (
        <div className="overflow-x-auto">
          <svg role="img" aria-label={title} viewBox={`0 0 ${width} 170`} className="h-44 w-full min-w-[480px]" preserveAspectRatio="none">
            {[0, 1, 2, 3].map((lineIndex) => <line key={lineIndex} x1="26" x2={width - 8} y1={25 + lineIndex * 40} y2={25 + lineIndex * 40} stroke="#e7e7e7" strokeDasharray="3 4" />)}
            {area && <path d={areaPath} fill="#8B5CF6" opacity=".2" />}
            <polyline points={line} fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map(({ x, y, item }, index) => (
              <g key={`${item.label}-${index}`}>
                <title>{`${item.label}: ${item.value}`}</title>
                <circle cx={x} cy={y} r="3.8" fill={chartColor(index + 1)} stroke="white" strokeWidth="2" />
              </g>
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-[#777777]"><span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span></div>
        </div>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

export function PieChart({
  title,
  description,
  data,
  emptyLabel
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  const positive = data.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  const segments = positive.map((item, index) => {
    const preceding = positive.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
    const start = -Math.PI / 2 + (preceding / total) * Math.PI * 2;
    const end = start + (item.value / total) * Math.PI * 2;
    const largeArc = end - start > Math.PI ? 1 : 0;
    const point = (r: number, a: number) => [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
    const [x1, y1] = point(78, start);
    const [x2, y2] = point(78, end);
    return {
      ...item,
      percent: Math.round((item.value / total) * 100),
      color: item.color ?? chartColor(index),
      path: `M 100 100 L ${x1} ${y1} A 78 78 0 ${largeArc} 1 ${x2} ${y2} Z`
    };
  });
  return (
    <ChartCard title={title} description={description}>
      {total ? (
        <div className="flex flex-wrap items-center justify-center gap-5">
          <svg role="img" aria-label={title} viewBox="0 0 200 200" className="h-44 w-44 shrink-0">
            {segments.map((segment) => <g key={segment.label}><title>{`${segment.label}: ${segment.value} (${segment.percent}%)`}</title><path d={segment.path} fill={segment.color} stroke="white" strokeWidth="2" /></g>)}
            <circle cx="100" cy="100" r="44" fill="#ffffff" />
            <text x="100" y="96" textAnchor="middle" className="fill-[#777777] text-[10px]">{total}</text>
            <text x="100" y="112" textAnchor="middle" className="fill-[#454545] text-[9px]">{title}</text>
          </svg>
          <ul className="min-w-[140px] space-y-2 text-xs">
            {segments.map((segment) => <li key={segment.label} className="flex items-center justify-between gap-4"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} /><span className="truncate">{segment.label}</span></span><span className="font-semibold tabular-nums">{segment.percent}%</span></li>)}
          </ul>
        </div>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

export function HistogramChart({
  title,
  description,
  values,
  bins = 6,
  emptyLabel
}: {
  title: string;
  description?: string;
  values: number[];
  bins?: number;
  emptyLabel?: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = max - min || 1;
  const buckets = Array.from({ length: bins }, (_, index) => ({
    label: `${Math.round(min + (width * index) / bins)}–${Math.round(min + (width * (index + 1)) / bins)}`,
    value: 0
  }));
  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor(((value - min) / width) * bins));
    buckets[index].value += 1;
  });
  return <ColumnChart title={title} description={description} data={values.length ? buckets : []} emptyLabel={emptyLabel} />;
}

export function ScatterPlot({
  title,
  description,
  data,
  bubble = false,
  emptyLabel,
  xLabel,
  yLabel
}: {
  title: string;
  description?: string;
  data: ScatterDatum[];
  bubble?: boolean;
  emptyLabel?: string;
  xLabel?: string;
  yLabel?: string;
}) {
  const maxX = Math.max(1, ...data.map((point) => point.x));
  const maxY = Math.max(1, ...data.map((point) => point.y));
  const maxSize = Math.max(1, ...data.map((point) => point.size ?? 1));
  return (
    <ChartCard title={title} description={description}>
      {data.length ? (
        <svg role="img" aria-label={title} viewBox="0 0 400 220" className="h-52 w-full">
          {[0, 1, 2, 3].map((line) => <g key={line}><line x1="38" x2="390" y1={20 + line * 50} y2={20 + line * 50} stroke="#e7e7e7" strokeDasharray="3 4" /><line x1={38 + line * 88} x2={38 + line * 88} y1="20" y2="170" stroke="#e7e7e7" /></g>)}
          <line x1="38" x2="390" y1="170" y2="170" stroke="#b8b8b8" />
          <line x1="38" x2="38" y1="20" y2="170" stroke="#b8b8b8" />
          {xLabel && <text x="214" y="207" textAnchor="middle" className="fill-[var(--muted)] text-[9px]">{xLabel}</text>}
          {yLabel && <text x="10" y="95" textAnchor="middle" transform="rotate(-90 10 95)" className="fill-[var(--muted)] text-[9px]">{yLabel}</text>}
          {data.map((point, index) => {
            const cx = 42 + (point.x / maxX) * 340;
            const cy = 166 - (point.y / maxY) * 140;
            const radius = bubble ? 5 + ((point.size ?? 1) / maxSize) * 15 : 5;
            return <g key={`${point.label}-${index}`}><title>{`${point.label}: ${point.x}, ${point.y}${bubble ? `, size ${point.size ?? 0}` : ""}`}</title><circle cx={cx} cy={cy} r={radius} fill={chartColor(index)} fillOpacity=".72" stroke="white" strokeWidth="2" /></g>;
          })}
        </svg>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

export function BoxPlot({
  title,
  description,
  values,
  emptyLabel
}: {
  title: string;
  description?: string;
  values: number[];
  emptyLabel?: string;
}) {
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (fraction: number) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]
    : 0;
  const low = quantile(0);
  const q1 = quantile(.25);
  const median = quantile(.5);
  const q3 = quantile(.75);
  const high = quantile(1);
  const range = Math.max(1, high - low);
  const x = (value: number) => 24 + ((value - low) / range) * 352;
  return (
    <ChartCard title={title} description={description}>
      {values.length ? (
        <>
          <svg role="img" aria-label={`${title}: min ${low}, Q1 ${q1}, median ${median}, Q3 ${q3}, max ${high}`} viewBox="0 0 400 100" className="h-24 w-full">
            <line x1={x(low)} x2={x(high)} y1="48" y2="48" stroke="#94a3b8" strokeWidth="2" />
            <line x1={x(low)} x2={x(low)} y1="38" y2="58" stroke="#94a3b8" strokeWidth="2" />
            <line x1={x(high)} x2={x(high)} y1="38" y2="58" stroke="#94a3b8" strokeWidth="2" />
            <rect x={x(q1)} y="28" width={Math.max(3, x(q3) - x(q1))} height="40" rx="5" fill="#8B5CF6" fillOpacity=".45" stroke="#C4B5FD" />
            <line x1={x(median)} x2={x(median)} y1="28" y2="68" stroke="#94a3b8" strokeWidth="3" />
            {sorted.filter((value) => value < q1 - 1.5 * (q3 - q1) || value > q3 + 1.5 * (q3 - q1)).map((value, index) => <circle key={`${value}-${index}`} cx={x(value)} cy="48" r="4" fill="#D95D5D" />)}
          </svg>
          <div className="flex justify-between text-[10px] text-[var(--muted)]"><span>{low}</span><span>Q1 {q1} · {`Median ${median}`} · Q3 {q3}</span><span>{high}</span></div>
        </>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

export function RadarChart({
  title,
  description,
  data,
  emptyLabel
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  const center = 100;
  const radius = 72;
  const angleFor = (index: number) => -Math.PI / 2 + (index * Math.PI * 2) / Math.max(data.length, 1);
  const max = Math.max(1, ...data.map((item) => item.value));
  const points = data.map((item, index) => {
    const angle = angleFor(index);
    const distance = (item.value / max) * radius;
    return `${center + distance * Math.cos(angle)},${center + distance * Math.sin(angle)}`;
  }).join(" ");
  return (
    <ChartCard title={title} description={description}>
      {data.length >= 3 ? (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <svg role="img" aria-label={title} viewBox="0 0 200 200" className="h-48 w-48">
            {[.25, .5, .75, 1].map((scale) => <polygon key={scale} points={data.map((_, index) => `${center + radius * scale * Math.cos(angleFor(index))},${center + radius * scale * Math.sin(angleFor(index))}`).join(" ")} fill="none" stroke="#e7e7e7" />)}
            <polygon points={points} fill="#8B5CF6" fillOpacity=".22" stroke="#38BDF8" strokeWidth="2.5" />
            {data.map((item, index) => {
              const angle = angleFor(index);
              return <g key={item.label}><circle cx={center + (item.value / max) * radius * Math.cos(angle)} cy={center + (item.value / max) * radius * Math.sin(angle)} r="3" fill="#438FB4" /><text x={center + 88 * Math.cos(angle)} y={center + 88 * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[8px]">{item.label.slice(0, 14)}</text></g>;
            })}
          </svg>
          <ul className="space-y-1.5 text-xs">{data.map((item, index) => <li key={item.label} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColor(index) }} />{item.label}: <b>{item.value}</b></li>)}</ul>
        </div>
      ) : <ChartEmpty label={emptyLabel} />}
    </ChartCard>
  );
}

function ChartEmpty({ label = "No data available" }: { label?: string }) {
  return <p className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] text-sm text-[#777777]">{label}</p>;
}
