'use client';

import { Menu, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAdminAuth } from '@/lib/admin/context';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface AdminTopbarProps {
  onOpenSidebar?: () => void;
  onOpenSearch?: () => void;
}

export function AdminTopbar({ onOpenSidebar, onOpenSearch }: AdminTopbarProps) {
  const { logout } = useAdminAuth();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="h-full px-4 sm:px-6 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </Button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex-1 max-w-md flex items-center gap-2 h-9 rounded-lg border border-input bg-muted/40 hover:bg-muted/60 px-3 text-sm text-muted-foreground transition-colors text-left"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">Buscar postal, usuario...</span>
          <span className="sm:hidden">Buscar...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                  A
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Sesión de admin
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
