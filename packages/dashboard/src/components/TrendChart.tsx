'use client';
import { useId, useState } from 'react';
import type { TrendPoint } from '../types';
import { EmptyState } from './EmptyState';

export interface TrendChartProps {
  title: string;
  /** Shown after each value, e.g. "%" or " s". */
  unit?: string;
  points: TrendPoint[];
  /** Fix the y range, e.g. 0 to 100 for a pass rate. */
  min?: number;
  max?: number;
}

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };

function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (lo === hi) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step)
    ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/**
 * One metric over recorded runs: a single line on one axis, a crosshair and tooltip on hover or
 * keyboard focus, and the same numbers as a table for screen readers and anyone who prefers it.
 */
export function TrendChart({ title, unit = '', points, min, max }: TrendChartProps) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  if (!points.length) return <EmptyState title={`No data for ${title.toLowerCase()} yet`} />;

  const values = points.map((p) => p.value);
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / span) * innerH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const ticks = niceTicks(lo, hi);
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit}`;
  const last = points[points.length - 1]!;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const shown = active === null ? null : points[active];

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };

  return (
    <figure className="aiqa-chart">
      <figcaption className="aiqa-chart__title" id={`${id}-title`}>
        {title}
        <span className="aiqa-chart__latest">
          Latest {fmt(last.value)} ({last.label})
        </span>
      </figcaption>
      <div className="aiqa-chart__plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={`${id}-title`}
          tabIndex={0}
          onMouseMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length - 1) - 1));
            if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? 0) + 1));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="aiqa-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="aiqa-chart__tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {fmt(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            // Every few runs, plus the latest; drop one that would crowd the latest label.
            (i % labelEvery === 0 && points.length - 1 - i >= labelEvery) || i === points.length - 1 ? (
              <text key={i} className="aiqa-chart__tick" x={x(i)} y={H - 10} textAnchor="middle">
                {p.label}
              </text>
            ) : null,
          )}
          <path className="aiqa-chart__line" d={path} />
          {points.map((p, i) => (
            <circle key={i} className="aiqa-chart__dot" cx={x(i)} cy={y(p.value)} r={active === i ? 5 : 4} />
          ))}
          {shown && active !== null ? (
            <line
              className="aiqa-chart__crosshair"
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + innerH}
            />
          ) : null}
        </svg>
        {shown && active !== null ? (
          <div
            className="aiqa-chart__tooltip"
            role="status"
            style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(shown.value) / H) * 100}%` }}
          >
            <span className="aiqa-chart__tooltip-label">{shown.label}</span>
            <span className="aiqa-chart__tooltip-value">{fmt(shown.value)}</span>
          </div>
        ) : null}
      </div>
      <details className="aiqa-chart__table">
        <summary>Show as a table</summary>
        <table className="aiqa-table">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col" className="num">
                {title}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td className="num">{fmt(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
