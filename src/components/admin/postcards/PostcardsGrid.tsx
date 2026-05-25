'use client';

import Link from 'next/link';
import { Eye, Calendar } from 'lucide-react';
import type { AdminPostcard } from '@/lib/admin/api';
import { StatusBadge } from './StatusBadge';
import { PostcardActions } from './PostcardActions';
import { formatDate, initials } from '@/lib/admin/format';

interface PostcardsGridProps {
  postcards: AdminPostcard[];
  onPreviewImage: (p: AdminPostcard) => void;
  onPreviewVideo: (p: AdminPostcard) => void;
  onEditImage: (p: AdminPostcard) => void;
  onEditVideo: (p: AdminPostcard) => void;
  onCopyLink: (p: AdminPostcard) => void;
  onDownload: (p: AdminPostcard, kind: 'image' | 'video') => void;
  onDelete?: (p: AdminPostcard) => void;
}

export function PostcardsGrid(props: PostcardsGridProps) {
  const { postcards } = props;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {postcards.map(p => (
        <article
          key={p.id}
          className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all"
        >
          <Link href={`/admin/postales/${p.id}`} className="block">
            <div className="aspect-[4/3] bg-muted overflow-hidden relative">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.title}
                  className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : null}
              <div className="absolute top-2 left-2">
                <StatusBadge status={p.processing_status} className="backdrop-blur-md bg-background/80" />
              </div>
              <div className="absolute top-2 right-2">
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-background/85 backdrop-blur-md border">
                  <Eye className="size-3" />
                  {p.ar_view_count}
                </div>
              </div>
            </div>
          </Link>
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/postales/${p.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {p.title}
                </p>
              </Link>
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
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {p.user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.user.imageUrl} alt="" className="size-5 rounded-full" />
              ) : (
                <span className="size-5 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center text-[9px] font-semibold">
                  {initials(p.user.firstName, p.user.lastName, p.user.email)}
                </span>
              )}
              <span className="truncate flex-1">{p.user.email}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="size-3" />
              {formatDate(p.created_at)}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
