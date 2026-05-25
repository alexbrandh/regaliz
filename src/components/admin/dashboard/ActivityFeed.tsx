import Link from 'next/link';
import type { AdminPostcard } from '@/lib/admin/api';
import { StatusBadge } from '@/components/admin/postcards/StatusBadge';
import { relativeTime, initials } from '@/lib/admin/format';

interface ActivityFeedProps {
  postcards: AdminPostcard[];
}

export function ActivityFeed({ postcards }: ActivityFeedProps) {
  if (postcards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Aún no hay actividad reciente
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {postcards.map(p => (
        <li key={p.id}>
          <Link
            href={`/admin/postales/${p.id}`}
            className="flex items-center gap-3 py-2 px-1 -mx-1 hover:bg-muted/40 rounded-md transition-colors"
          >
            {p.user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.user.imageUrl} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                {initials(p.user.firstName, p.user.lastName, p.user.email)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">
                  {p.user.firstName || p.user.email.split('@')[0]}
                </span>{' '}
                <span className="text-muted-foreground">creó</span>{' '}
                <span className="font-medium truncate">{p.title}</span>
              </p>
              <p className="text-xs text-muted-foreground">{relativeTime(p.created_at)}</p>
            </div>
            <StatusBadge status={p.processing_status} variant="dot" className="shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
