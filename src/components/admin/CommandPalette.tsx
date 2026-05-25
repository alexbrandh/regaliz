'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, LayoutDashboard, ImageIcon, Users, Settings, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api, type AdminPostcard } from '@/lib/admin/api';
import { useAdminAuth } from '@/lib/admin/context';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  group: 'Ir a' | 'Postales' | 'Acciones';
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { logout } = useAdminAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminPostcard[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await api.listPostcards({ search: query, limit: 6 });
      if (cancelled) return;
      setResults(res.data?.postcards ?? []);
      setSearching(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setSearching(false);
    };
  }, [query]);

  const navItems: CommandItem[] = useMemo(
    () => [
      { id: 'nav-dashboard', label: 'Resumen', group: 'Ir a', icon: LayoutDashboard, onSelect: () => router.push('/admin') },
      { id: 'nav-postales', label: 'Postales', group: 'Ir a', icon: ImageIcon, onSelect: () => router.push('/admin/postales') },
      { id: 'nav-usuarios', label: 'Usuarios', group: 'Ir a', icon: Users, onSelect: () => router.push('/admin/usuarios') },
      { id: 'nav-ajustes', label: 'Ajustes', group: 'Ir a', icon: Settings, onSelect: () => router.push('/admin/ajustes') },
      { id: 'act-refresh', label: 'Recargar datos', group: 'Acciones', icon: RefreshCw, onSelect: () => window.location.reload() },
      { id: 'act-logout', label: 'Cerrar sesión', group: 'Acciones', icon: LogOut, onSelect: () => logout() },
    ],
    [router, logout]
  );

  const filteredNav = useMemo(() => {
    if (!query.trim()) return navItems;
    const q = query.toLowerCase();
    return navItems.filter(i => i.label.toLowerCase().includes(q));
  }, [query, navItems]);

  const postcardItems: CommandItem[] = results.map(p => ({
    id: `pc-${p.id}`,
    label: p.title,
    description: p.user.email,
    group: 'Postales',
    icon: ImageIcon,
    onSelect: () => router.push(`/admin/postales/${p.id}`),
  }));

  const groups: Array<{ name: string; items: CommandItem[] }> = [];
  if (postcardItems.length) groups.push({ name: 'Postales', items: postcardItems });
  if (filteredNav.length) {
    const goTo = filteredNav.filter(i => i.group === 'Ir a');
    const actions = filteredNav.filter(i => i.group === 'Acciones');
    if (goTo.length) groups.push({ name: 'Ir a', items: goTo });
    if (actions.length) groups.push({ name: 'Acciones', items: actions });
  }

  const handleSelect = (item: CommandItem) => {
    onOpenChange(false);
    item.onSelect();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl">
        <DialogTitle className="sr-only">Buscar y navegar</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 h-12">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Busca una postal, usuario o sección..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            autoFocus
          />
          {searching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
          ) : (
            groups.map(group => (
              <div key={group.name} className="mb-2 last:mb-0">
                <p className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </p>
                <ul>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent text-left'
                          )}
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {item.description}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>Pulsa Enter para abrir</span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Esc</kbd>
        </div>
      </DialogContent>
    </Dialog>
  );
}
