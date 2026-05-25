import { cn } from '@/lib/utils';
import { getStatusMeta } from '@/lib/admin/status';

interface StatusBadgeProps {
  status: string;
  className?: string;
  variant?: 'default' | 'dot';
}

export function StatusBadge({ status, className, variant = 'default' }: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex items-center gap-2 text-xs font-medium', className)}>
        <span className={cn('size-2 rounded-full', meta.dotClassName)} />
        {meta.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        meta.className,
        className
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}
