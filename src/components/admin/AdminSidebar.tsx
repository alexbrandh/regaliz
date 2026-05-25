'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ImageIcon, Users, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/admin/postales', label: 'Postales', icon: ImageIcon },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/ajustes', label: 'Ajustes', icon: Settings },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      <div className="px-6 py-5 flex items-center gap-2.5">
        <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-sidebar-foreground">Regaliz</p>
          <p className="text-xs text-sidebar-foreground/60">Panel admin</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-sidebar-foreground/60')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/50">
          Versión {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
}

export const ADMIN_NAV = NAV;
