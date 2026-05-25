import type { ProcessingStatus } from '@/types/database';
import { CheckCircle2, Clock, AlertCircle, ImageOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const STATUS_META: Record<ProcessingStatus, {
  label: string;
  icon: LucideIcon;
  className: string;
  dotClassName: string;
}> = {
  ready: {
    label: 'Lista',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dotClassName: 'bg-emerald-500',
  },
  processing: {
    label: 'Procesando',
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dotClassName: 'bg-amber-500',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dotClassName: 'bg-rose-500',
  },
  needs_better_image: {
    label: 'Mejor imagen',
    icon: ImageOff,
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    dotClassName: 'bg-orange-500',
  },
};

export function getStatusMeta(status: string) {
  return STATUS_META[status as ProcessingStatus] ?? {
    label: status,
    icon: AlertCircle,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  };
}
