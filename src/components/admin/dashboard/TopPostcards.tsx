import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { AnalyticsResponse } from '@/lib/admin/api';
import { formatNumber, initials } from '@/lib/admin/format';

interface TopPostcardsProps {
  postcards: AnalyticsResponse['topPostcards'];
}

export function TopPostcards({ postcards }: TopPostcardsProps) {
  if (postcards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Aún no hay postales con vistas registradas
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {postcards.map((p, i) => (
        <li key={p.id}>
          <Link
            href={`/admin/postales/${p.id}`}
            className="flex items-center gap-3 py-3 px-1 -mx-1 hover:bg-muted/40 rounded-md transition-colors"
          >
            <span className="size-6 rounded-md bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums">
              {i + 1}
            </span>
            <div className="size-10 rounded-md bg-muted overflow-hidden shrink-0 ring-1 ring-border">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="size-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center text-[8px] font-semibold">
                  {initials(p.user.firstName, p.user.lastName, p.user.email)}
                </span>
                {p.user.email}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-sm font-medium tabular-nums shrink-0">
              <Eye className="size-3.5 text-muted-foreground" />
              {formatNumber(p.ar_view_count)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
