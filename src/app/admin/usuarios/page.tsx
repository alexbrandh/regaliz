'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Mail, Eye, ImageIcon, Search, Users as UsersIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api, type UserSummary } from '@/lib/admin/api';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/admin/common/Skeleton';
import { EmptyState } from '@/components/admin/common/EmptyState';
import { formatNumber, initials, relativeTime } from '@/lib/admin/format';

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.listUsers().then(res => {
      if (cancelled) return;
      if (res.success && res.data) setUsers(res.data.users);
      else toast({ title: 'Error', description: res.error, variant: 'destructive' });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      (u.firstName?.toLowerCase().includes(q)) ||
      (u.lastName?.toLowerCase().includes(q))
    );
  }, [users, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clientes que han creado al menos una postal de realidad aumentada
        </p>
      </header>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={search ? 'Sin resultados' : 'Aún no hay usuarios'}
            description={
              search
                ? 'Prueba con otro nombre o email'
                : 'Cuando alguien cree su primera postal aparecerá aquí'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b">
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium text-right">Postales</th>
                  <th className="px-4 py-3 font-medium text-right">Vistas totales</th>
                  <th className="px-4 py-3 font-medium">Última actividad</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const fullName = u.firstName && u.lastName
                    ? `${u.firstName} ${u.lastName}`
                    : u.firstName || u.lastName || u.email.split('@')[0];
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.imageUrl} alt="" className="size-9 rounded-full object-cover" />
                          ) : (
                            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                              {initials(u.firstName, u.lastName, u.email)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{fullName}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                              <Mail className="size-3 shrink-0" />
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                          <ImageIcon className="size-3.5 text-muted-foreground" />
                          {formatNumber(u.postcardCount)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                          <Eye className="size-3.5 text-muted-foreground" />
                          {formatNumber(u.totalViews)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {u.lastActivity ? relativeTime(u.lastActivity) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/postales?userId=${u.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver postales
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
