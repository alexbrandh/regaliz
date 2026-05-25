'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDateShort, formatNumber } from '@/lib/admin/format';

interface TrendChartProps {
  data: Array<{ date: string; created: number; views: number }>;
  className?: string;
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 32 };
const VIEW_HEIGHT = 240;

export function TrendChart({ data, className }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const { width, points, maxY, axisLabels, axisXTicks } = useMemo(() => {
    const w = Math.max(320, data.length * 18);
    const innerW = w - PADDING.left - PADDING.right;
    const innerH = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

    const all = data.flatMap(d => [d.created, d.views]);
    const maxY = Math.max(1, ...all);
    const niceMax = niceCeil(maxY);
    const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

    const points = data.map((d, i) => {
      const x = PADDING.left + i * step;
      const yCreated = PADDING.top + (1 - d.created / niceMax) * innerH;
      const yViews = PADDING.top + (1 - d.views / niceMax) * innerH;
      return { x, yCreated, yViews, d };
    });

    const tickCount = 4;
    const axisLabels = Array.from({ length: tickCount + 1 }, (_, i) => {
      const val = Math.round((niceMax / tickCount) * (tickCount - i));
      const y = PADDING.top + (i / tickCount) * innerH;
      return { val, y };
    });

    const xTickEvery = Math.ceil(data.length / 6);
    const axisXTicks = points
      .map((p, i) => ({ ...p, i }))
      .filter(p => p.i % xTickEvery === 0 || p.i === data.length - 1);

    return { width: w, points, maxY: niceMax, axisLabels, axisXTicks };
  }, [data]);

  if (data.length === 0) {
    return <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">Sin datos</div>;
  }

  const createdPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.yCreated.toFixed(2)}`)
    .join(' ');
  const viewsPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.yViews.toFixed(2)}`)
    .join(' ');

  const hoverPoint = hover !== null ? points[hover] : null;

  return (
    <div className={cn('relative w-full overflow-x-auto', className)}>
      <svg
        width={width}
        height={VIEW_HEIGHT}
        viewBox={`0 0 ${width} ${VIEW_HEIGHT}`}
        className="block"
        onMouseLeave={() => setHover(null)}
      >
        {/* Y grid lines */}
        {axisLabels.map((tick, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={tick.y}
              y2={tick.y}
              className="stroke-border"
              strokeDasharray="2 4"
            />
            <text
              x={PADDING.left - 6}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {tick.val}
            </text>
          </g>
        ))}

        {/* X ticks */}
        {axisXTicks.map(t => (
          <text
            key={t.i}
            x={t.x}
            y={VIEW_HEIGHT - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {formatDateShort(t.d.date)}
          </text>
        ))}

        {/* Views line (secondary color) */}
        <path d={viewsPath} fill="none" className="stroke-[var(--chart-2)] stroke-2" />

        {/* Created line (primary) */}
        <path d={createdPath} fill="none" className="stroke-primary stroke-2" />

        {/* Hover hit area */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - 6}
            y={PADDING.top}
            width={12}
            height={VIEW_HEIGHT - PADDING.top - PADDING.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {/* Hover indicator */}
        {hoverPoint && (
          <g>
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={PADDING.top}
              y2={VIEW_HEIGHT - PADDING.bottom}
              className="stroke-border"
            />
            <circle cx={hoverPoint.x} cy={hoverPoint.yCreated} r={3.5} className="fill-primary" />
            <circle cx={hoverPoint.x} cy={hoverPoint.yViews} r={3.5} className="fill-[var(--chart-2)]" />
          </g>
        )}
      </svg>

      {hoverPoint && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-md border bg-popover text-popover-foreground shadow-md p-2.5 text-xs space-y-1.5"
          style={{
            left: Math.min(Math.max(hoverPoint.x - 70, 8), width - 150),
          }}
        >
          <p className="font-medium">{formatDateShort(hoverPoint.d.date)}</p>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Postales:</span>
            <span className="font-medium tabular-nums">{formatNumber(hoverPoint.d.created)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--chart-2)]" />
            <span className="text-muted-foreground">Vistas AR:</span>
            <span className="font-medium tabular-nums">{formatNumber(hoverPoint.d.views)}</span>
          </div>
        </div>
      )}

      <p className="sr-only">Máximo en escala: {maxY}</p>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  if (n <= 25) return 25;
  if (n <= 50) return 50;
  if (n <= 100) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / mag) * mag;
}
