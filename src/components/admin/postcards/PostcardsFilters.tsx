'use client';

import { Search, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ViewMode = 'table' | 'grid';
export type SortKey = 'created_at' | 'updated_at' | 'title' | 'ar_view_count';

interface PostcardsFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  sortBy: SortKey;
  onSortByChange: (v: SortKey) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function PostcardsFilters({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  onRefresh,
  refreshing,
}: PostcardsFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título o descripción..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select value={sortBy} onValueChange={v => onSortByChange(v as SortKey)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Más recientes</SelectItem>
            <SelectItem value="updated_at">Actualizadas</SelectItem>
            <SelectItem value="ar_view_count">Más vistas</SelectItem>
            <SelectItem value="title">Título A-Z</SelectItem>
          </SelectContent>
        </Select>

        <div className="inline-flex items-center rounded-md border bg-background">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            aria-pressed={viewMode === 'table'}
            title="Vista tabla"
            className={cn(
              'h-9 w-9 inline-flex items-center justify-center rounded-l-md',
              viewMode === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            aria-pressed={viewMode === 'grid'}
            title="Vista grid"
            className={cn(
              'h-9 w-9 inline-flex items-center justify-center rounded-r-md border-l',
              viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>

        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            title="Recargar"
          >
            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          </Button>
        )}
      </div>
    </div>
  );
}
