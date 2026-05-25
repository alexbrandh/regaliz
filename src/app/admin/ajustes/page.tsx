'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, LogOut, KeyRound, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/lib/admin/context';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAdminAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preferencias del panel de administración
        </p>
      </header>

      <section className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-1">Apariencia</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Elige cómo se ve el panel
        </p>

        <div className="grid grid-cols-3 gap-2 max-w-md">
          {[
            { id: 'light', label: 'Claro', icon: Sun },
            { id: 'dark', label: 'Oscuro', icon: Moon },
            { id: 'system', label: 'Sistema', icon: Monitor },
          ].map(opt => {
            const Icon = opt.icon;
            const active = mounted && theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-all',
                  active
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-input hover:border-muted-foreground/30'
                )}
              >
                <Icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          Seguridad
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Gestiona tu sesión administrativa
        </p>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm mb-4">
          <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-muted-foreground">
            Tu sesión está vinculada a esta pestaña. Si cierras la ventana o el navegador, deberás
            volver a ingresar la contraseña.
          </p>
        </div>

        <Button variant="outline" onClick={logout} className="text-destructive hover:text-destructive">
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </section>

      <section className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-1">Atajos de teclado</h2>
        <p className="text-sm text-muted-foreground mb-4">Para moverte más rápido</p>
        <dl className="divide-y">
          {[
            { keys: ['⌘', 'K'], desc: 'Abrir buscador y comandos' },
            { keys: ['Esc'], desc: 'Cerrar modales' },
          ].map(s => (
            <div key={s.desc} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-muted-foreground">{s.desc}</dt>
              <dd className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border bg-muted px-1.5 text-[11px] font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
