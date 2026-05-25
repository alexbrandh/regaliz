'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/lib/admin/context';
import { AdminLogin } from './AdminLogin';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { CommandPalette } from './CommandPalette';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <AdminLogin />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="lg:grid lg:grid-cols-[240px_1fr] min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden lg:block sticky top-0 h-screen">
          <AdminSidebar />
        </div>

        {/* Mobile sidebar */}
        <div
          className={cn(
            'lg:hidden fixed inset-0 z-50 transition-opacity',
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          )}
          aria-hidden={!mobileOpen}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <div
            className={cn(
              'absolute top-0 left-0 h-full w-72 max-w-[80vw] transition-transform',
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 size-8 rounded-md bg-sidebar text-sidebar-foreground/70 hover:text-sidebar-foreground border border-sidebar-border flex items-center justify-center"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-w-0 flex flex-col">
          <AdminTopbar
            onOpenSidebar={() => setMobileOpen(true)}
            onOpenSearch={() => setPaletteOpen(true)}
          />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
