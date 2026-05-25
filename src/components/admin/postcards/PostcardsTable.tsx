'use client';

import { Eye, Mail, Calendar } from 'lucide-react';
import Link from 'next/link';
import type { AdminPostcard } from '@/lib/admin/api';
import { StatusBadge } from './StatusBadge';
import { PostcardActions } from './PostcardActions';
import { formatDate, initials } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

interface PostcardsTableProps {
  postcards: AdminPostcard[];
  onPreviewImage: (p: AdminPostcard) => void;
  onPreviewVideo: (p: AdminPostcard) => void;
  onEditImage: (p: AdminPostcard) => void;
  onEditVideo: (p: AdminPostcard) => void;
  onCopyLink: (p: AdminPostcard) => void;
  onDownload: (p: AdminPostcard, kind: 'image' | 'video') => void;
  onDelete?: (p: AdminPostcard) => void;
}

export function PostcardsTable(props: PostcardsTableProps) {
  const { postcards } = props;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b">
            <th className="px-4 py-3 font-medium">Postal</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium text-right">Vistas</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium w-12"></th>
          </tr>
        </thead>
        <tbody>
          {postcards.map(p => {
            const name = p.user.firstName && p.user.lastName
              ? `${p.user.firstName} ${p.user.lastName}`
              : p.user.firstName || p.user.lastName || 'Sin nombre';
            return (
              <tr
                key={p.id}
                className="border-b last:border-0 hover:bg-muted/40 group transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/postales/${p.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <div className="size-11 rounded-lg bg-muted overflow-hidden shrink-0 ring-1 ring-border">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[220px] group-hover:text-primary transition-colors">
                        {p.title}
                      </p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {p.user.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.user.imageUrl}
                        alt=""
                        className="size-8 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                        {initials(p.user.firstName, p.user.lastName, p.user.email)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[180px]">{name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[180px]">
                        <Mail className="size-3 shrink-0" />
                        {p.user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.processing_status} />
                  {p.error_message && (
                    <p
                      className="text-[11px] text-destructive mt-1 truncate max-w-[160px]"
                      title={p.error_message}
                    >
                      {p.error_message}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                    <Eye className="size-3.5 text-muted-foreground" />
                    {p.ar_view_count}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    <span>{formatDate(p.created_at)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PostcardActions
                    postcard={p}
                    onPreviewImage={props.onPreviewImage}
                    onPreviewVideo={props.onPreviewVideo}
                    onEditImage={props.onEditImage}
                    onEditVideo={props.onEditVideo}
                    onCopyLink={props.onCopyLink}
                    onDownload={props.onDownload}
                    onDelete={props.onDelete}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PostcardsTableCompact({
  postcards,
  className,
}: {
  postcards: Pick<AdminPostcard, 'id' | 'title' | 'image_url' | 'ar_view_count' | 'user'>[];
  className?: string;
}) {
  return (
    <ul className={cn('divide-y', className)}>
      {postcards.map(p => (
        <li key={p.id}>
          <Link
            href={`/admin/postales/${p.id}`}
            className="flex items-center gap-3 py-2.5 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
          >
            <div className="size-10 rounded-md bg-muted overflow-hidden shrink-0 ring-1 ring-border">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="size-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground truncate">{p.user.email}</p>
            </div>
            <div className="inline-flex items-center gap-1 text-sm font-medium tabular-nums shrink-0">
              <Eye className="size-3.5 text-muted-foreground" />
              {p.ar_view_count}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
