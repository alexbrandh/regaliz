'use client';

import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/admin/format';

export type StatusFilter = 'all' | 'ready' | 'processing' | 'error' | 'needs_better_image';

interface StatusTabsProps {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: {
    total: number;
    ready: number;
    processing: number;
    error: number;
    needsBetterImage: number;
  };
}

const TABS: Array<{ id: StatusFilter; label: string; key: keyof StatusTabsProps['counts'] }> = [
  { id: 'all', label: 'Todas', key: 'total' },
  { id: 'ready', label: 'Listas', key: 'ready' },
  { id: 'processing', label: 'Procesando', key: 'processing' },
  { id: 'needs_better_image', label: 'Mejor imagen', key: 'needsBetterImage' },
  { id: 'error', label: 'Errores', key: 'error' },
];

export function StatusTabs({ value, onChange, counts }: StatusTabsProps) {
  return (
    <div className="border-b border-border overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <nav className="flex gap-1" role="tablist" aria-label="Filtrar por estado">
        {TABS.map(tab => {
          const active = value === tab.id;
          const count = counts[tab.key];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-semibold',
                  active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {formatNumber(count)}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
