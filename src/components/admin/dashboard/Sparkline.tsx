import { cn } from '@/lib/utils';

interface SparklineProps {
  values: number[];
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  values,
  className,
  strokeClassName = 'stroke-primary',
  fillClassName = 'fill-primary/10',
  width = 80,
  height = 28,
}: SparklineProps) {
  if (values.length === 0) {
    return <div style={{ width, height }} className={cn('rounded bg-muted/40', className)} />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const area =
    points.length > 1
      ? `${path} L ${width} ${height} L 0 ${height} Z`
      : '';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
    >
      {area && <path d={area} className={cn('stroke-none', fillClassName)} />}
      <path d={path} fill="none" strokeWidth={1.5} className={cn('stroke-2', strokeClassName)} />
    </svg>
  );
}
