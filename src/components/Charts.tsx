import React from 'react';
import { formatCompactINR, formatINR } from '../lib/finance';

export function GroupedBarChart({
  title,
  subtitle,
  data,
  primaryLabel = 'Income',
  secondaryLabel = 'Expenses',
}: {
  title: string;
  subtitle?: string;
  data: Array<{ label: string; primary: number; secondary: number }>;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.primary, d.secondary]));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#0F274A] dark:bg-[#D4AF37]" />
            {primaryLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-600 dark:bg-slate-500" />
            {secondaryLabel}
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-500">
          No cash flow data for selected period
        </div>
      ) : (
        <div className="grid gap-3 items-end h-44 pt-4" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d) => {
            const h1 = Math.max(4, Math.round((d.primary / maxVal) * 124));
            const h2 = Math.max(4, Math.round((d.secondary / maxVal) * 124));
            return (
              <div key={d.label} className="flex flex-col items-center justify-end h-full gap-1.5">
                <div className="flex items-end gap-1.5 h-32">
                  <div
                    title={`${primaryLabel}: ${formatINR(d.primary)}`}
                    style={{ height: `${h1}px` }}
                    className="w-4 sm:w-5 rounded-t bg-[#0F274A] dark:bg-[#D4AF37] transition-all"
                  />
                  <div
                    title={`${secondaryLabel}: ${formatINR(d.secondary)}`}
                    style={{ height: `${h2}px` }}
                    className="w-4 sm:w-5 rounded-t bg-amber-600 dark:bg-slate-500 transition-all"
                  />
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TrendLineChart({
  title,
  subtitle,
  points,
  color = '#D4AF37',
}: {
  title: string;
  subtitle?: string;
  points: Array<{ label: string; value: number }>;
  color?: string;
}) {
  const width = 480;
  const height = 176;
  const padX = 28;
  const padTop = 18;
  const padBottom = 28;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const span = Math.max(1, maxV - minV);

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (idx / (points.length - 1)) * (width - padX * 2);
    const y = height - padBottom - ((p.value - minV) / span) * (height - padTop - padBottom);
    return { ...p, x, y };
  });

  const baselineY = height - padBottom;
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area =
    coords.length > 0
      ? `${coords[0].x},${baselineY} ${polyline} ${coords[coords.length - 1].x},${baselineY}`
      : '';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {points.length > 0 && (
          <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-amber-400">
            {formatCompactINR(points[points.length - 1].value)}
          </span>
        )}
      </div>

      {points.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-500">
          No trend data available
        </div>
      ) : (
        <div>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
            <line
              x1={padX}
              y1={baselineY}
              x2={width - padX}
              y2={baselineY}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="1"
            />
            {coords.length > 1 && (
              <>
                <polygon points={area} fill={color} fillOpacity="0.12" />
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polyline}
                />
              </>
            )}
            {coords.map((c) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r="4" fill={color} />
                <text
                  x={c.x}
                  y={height - 8}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-[11px] font-mono fill-slate-500 dark:fill-slate-400"
                >
                  {c.label}
                </text>
                <title>{`${c.label}: ${formatINR(c.value)}`}</title>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

const DONUT_COLORS = ['#0F274A', '#C89B3C', '#1D4ED8', '#16A34A', '#D97706', '#64748B', '#0D9488'];

export function DonutBreakdownChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ label: string; value: number }>;
}) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>

      {total <= 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-500">
          No breakdown records yet
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              {items.slice(0, 7).map((item, idx) => {
                const frac = Math.max(0, item.value) / total;
                const dash = frac * circumference;
                const offset = -cumulative * circumference;
                cumulative += frac;
                return (
                  <circle
                    key={item.label}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke={DONUT_COLORS[idx % DONUT_COLORS.length]}
                    strokeWidth="16"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                  >
                    <title>{`${item.label}: ${formatINR(item.value)}`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Total</span>
              <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {formatCompactINR(total)}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            {items.slice(0, 6).map((item, idx) => {
              const pct = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                    />
                    <span className="truncate text-slate-700 dark:text-slate-300">{item.label}</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                    {formatCompactINR(item.value)} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function HorizontalProgressChart({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; current: number; target: number; caption?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-slate-500">
          No items recorded yet
        </div>
      ) : (
        <div className="space-y-3.5">
          {rows.map((r) => {
            const pct = r.target > 0 ? Math.min(100, Math.round((r.current / r.target) * 100)) : 0;
            return (
              <div key={r.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {r.label}
                  </span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                    {formatCompactINR(r.current)} / {formatCompactINR(r.target)} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0F274A] dark:bg-[#D4AF37] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {r.caption && <p className="text-[11px] text-slate-500">{r.caption}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
