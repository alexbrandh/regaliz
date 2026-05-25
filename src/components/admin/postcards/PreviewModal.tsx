'use client';

import { useState, useEffect } from 'react';
import { Download, ImageIcon, Video, User, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import type { AdminPostcard } from '@/lib/admin/api';
import { formatDate } from '@/lib/admin/format';

interface PreviewModalProps {
  postcard: AdminPostcard | null;
  type: 'image' | 'video' | null;
  onClose: () => void;
  onDownload: (p: AdminPostcard, kind: 'image' | 'video') => void;
}

export function PreviewModal({ postcard, type, onClose, onDownload }: PreviewModalProps) {
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [postcard?.id, type]);

  const open = !!postcard && !!type;
  if (!postcard || !type) {
    return <Dialog open={open} onOpenChange={v => !v && onClose()} />;
  }

  const url = type === 'image' ? postcard.image_url : postcard.video_url;
  const Icon = type === 'image' ? ImageIcon : Video;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base truncate">{postcard.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {type === 'image' ? 'Imagen de la postal' : 'Video de la experiencia AR'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onDownload(postcard, type)}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Descargar</span>
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-muted/30 flex items-center justify-center">
          {type === 'image' ? (
            !mediaError && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={postcard.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-sm"
                onError={() => setMediaError(true)}
              />
            ) : (
              <NoMedia type="image" url={url} />
            )
          ) : !mediaError && url ? (
            <video
              src={url}
              controls
              autoPlay
              className="max-w-full max-h-[65vh] rounded-lg shadow-sm"
              onError={() => setMediaError(true)}
            >
              Tu navegador no soporta la reproducción de video.
            </video>
          ) : (
            <NoMedia type="video" url={url} />
          )}
        </div>

        <div className="px-5 py-3 border-t bg-background flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="size-3.5" />
            {postcard.user.email}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {formatDate(postcard.created_at, { withTime: true })}
          </span>
          <StatusBadge status={postcard.processing_status} variant="dot" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NoMedia({ type, url }: { type: 'image' | 'video'; url?: string }) {
  const Icon = type === 'image' ? ImageIcon : Video;
  return (
    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
      <Icon className="size-12 mb-3" />
      <p className="text-sm">{url ? 'No se pudo cargar el archivo' : 'Archivo no disponible'}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-xs text-primary hover:underline"
        >
          Abrir URL directamente
        </a>
      )}
    </div>
  );
}
