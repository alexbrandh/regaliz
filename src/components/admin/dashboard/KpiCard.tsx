import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber, formatDelta } from '@/lib/admin/format';
import { Sparkline } from './Sparkline';

interface KpiCardProps {
  label: string;
  value: number;
  previousValue?: number;
  icon: LucideIcon;
  iconClassName?: string;
  sparkline?: number[];
  hint?: string;
}

export function KpiCard({
  label,
  value,
  previousValue,
  icon: Icon,
  iconClassName = 'bg-primary/10 text-primary',
  sparkline,
  hint,
}: KpiCardProps) {
  const delta = previousValue !== undefined ? formatDelta(value, previousValue) : null;
  const DeltaIcon = delta?.sign === 'up' ? TrendingUp : delta?.sign === 'down' ? TrendingDown : Minus;

  return (
    <div className="rounded-xl border bg-card p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatNumber(value)}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={cn('size-10 rounded-lg flex items-center justify-center', iconClassName)}>
          <Icon className="size-5" />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        {delta ? (
          <div
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              delta.sign === 'up' && 'text-emerald-600 dark:text-emerald-400',
              delta.sign === 'down' && 'text-rose-600 dark:text-rose-400',
              delta.sign === 'flat' && 'text-muted-foreground'
            )}
          >
            <DeltaIcon className="size-3.5" />
            {delta.sign === 'flat' ? 'sin cambios' : `${Math.abs(delta.pct)}%`}
            <span className="text-muted-foreground font-normal">vs período anterior</span>
          </div>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length > 0 && <Sparkline values={sparkline} />}
      </div>
    </div>
  );
}
