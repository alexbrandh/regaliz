'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImageIcon, Eye, Users, Activity, ArrowRight, AlertCircle } from 'lucide-react';
import { api, type AnalyticsResponse, type PostcardListResponse } from '@/lib/admin/api';
import { KpiCard } from '@/components/admin/dashboard/KpiCard';
import { TrendChart } from '@/components/admin/dashboard/TrendChart';
import { TopPostcards } from '@/components/admin/dashboard/TopPostcards';
import { ActivityFeed } from '@/components/admin/dashboard/ActivityFeed';
import { Skeleton } from '@/components/admin/common/Skeleton';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [recent, setRecent] = useState<PostcardListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.analytics(30), api.listPostcards({ limit: 6, page: 1, sortBy: 'created_at' })])
      .then(([a, p]) => {
        if (cancelled) return;
        if (a.success && a.data) setAnalytics(a.data);
        if (p.success && p.data) setRecent(p.data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const stats = recent?.stats;
  const dailyCreated = analytics?.daily.map(d => d.created) ?? [];
  const dailyViews = analytics?.daily.map(d => d.views) ?? [];

  const pendingTotal =
    (stats?.processing ?? 0) + (stats?.error ?? 0) + (stats?.needsBetterImage ?? 0);
  const prevPending =
    (analytics?.previousPeriod.created ?? 0) === 0 ? 0 : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vista general de la actividad de Regaliz en los últimos 30 días
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total postales"
            value={stats?.total ?? 0}
            previousValue={(stats?.total ?? 0) - (analytics?.currentPeriod.created ?? 0)}
            icon={ImageIcon}
            iconClassName="bg-primary/10 text-primary"
            sparkline={dailyCreated}
            hint={`+${analytics?.currentPeriod.created ?? 0} este período`}
          />
          <KpiCard
            label="Vistas de realidad aumentada"
            value={stats?.totalArViews ?? 0}
            previousValue={(stats?.totalArViews ?? 0) - (analytics?.currentPeriod.views ?? 0)}
            icon={Eye}
            iconClassName="bg-chart-2/10 text-[var(--chart-2)]"
            sparkline={dailyViews}
            hint={`+${analytics?.currentPeriod.views ?? 0} este período`}
          />
          <KpiCard
            label="Usuarios"
            value={stats?.uniqueUsers ?? 0}
            icon={Users}
            iconClassName="bg-[var(--chart-3)]/10 text-[var(--chart-3)]"
            hint="clientes únicos"
          />
          <KpiCard
            label="Pendientes"
            value={pendingTotal}
            previousValue={prevPending}
            icon={AlertCircle}
            iconClassName="bg-amber-500/10 text-amber-600"
            hint={`${stats?.processing ?? 0} procesando · ${stats?.error ?? 0} con error`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Actividad últimos 30 días</h2>
              <p className="text-xs text-muted-foreground">Postales creadas y vistas de realidad aumentada por día</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                Postales
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-2" />
                Vistas de realidad aumentada
              </span>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-[240px]" />
          ) : (
            <TrendChart data={analytics?.daily ?? []} />
          )}
        </section>

        <section className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-semibold">Top postales</h2>
              <p className="text-xs text-muted-foreground">Por número de vistas de realidad aumentada</p>
            </div>
            <Link
              href="/admin/postales"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver todas <ArrowRight className="size-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3 mt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <TopPostcards postcards={analytics?.topPostcards ?? []} />
          )}
        </section>
      </div>

      <section className="bg-card border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold inline-flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              Actividad reciente
            </h2>
            <p className="text-xs text-muted-foreground">Últimas postales creadas</p>
          </div>
          <Link
            href="/admin/postales"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Ver todas <ArrowRight className="size-3" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <ActivityFeed postcards={(recent?.postcards ?? []).slice(0, 6)} />
        )}
      </section>
    </div>
  );
}
