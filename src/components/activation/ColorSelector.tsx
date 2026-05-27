'use client';

import { cn } from '@/lib/utils';
import type { VariantColor } from '@/lib/shopify/constants';

interface ColorSelectorProps {
  value: VariantColor;
  onChange: (color: VariantColor) => void;
}

export function ColorSelector({ value, onChange }: ColorSelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('beige')}
        className={cn(
          'flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
          value === 'beige'
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-primary/50'
        )}
        aria-pressed={value === 'beige'}
      >
        <span className="inline-block w-3 h-3 rounded-full bg-[#E8D5B7] mr-2 align-middle ring-1 ring-border" />
        Beige
      </button>
      <button
        type="button"
        onClick={() => onChange('negro')}
        className={cn(
          'flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
          value === 'negro'
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-primary/50'
        )}
        aria-pressed={value === 'negro'}
      >
        <span className="inline-block w-3 h-3 rounded-full bg-[#1a1a1a] mr-2 align-middle ring-1 ring-border" />
        Negro
      </button>
    </div>
  );
}
