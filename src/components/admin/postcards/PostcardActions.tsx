'use client';

import { MoreHorizontal, Eye, Play, Download, ImageIcon, Video, Link as LinkIcon, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AdminPostcard } from '@/lib/admin/api';

interface PostcardActionsProps {
  postcard: AdminPostcard;
  onPreviewImage: (p: AdminPostcard) => void;
  onPreviewVideo: (p: AdminPostcard) => void;
  onEditImage: (p: AdminPostcard) => void;
  onEditVideo: (p: AdminPostcard) => void;
  onCopyLink: (p: AdminPostcard) => void;
  onDownload: (p: AdminPostcard, kind: 'image' | 'video') => void;
  onDelete?: (p: AdminPostcard) => void;
}

export function PostcardActions({
  postcard,
  onPreviewImage,
  onPreviewVideo,
  onEditImage,
  onEditVideo,
  onCopyLink,
  onDownload,
  onDelete,
}: PostcardActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Acciones"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Ver</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onPreviewImage(postcard)} disabled={!postcard.image_url}>
          <ImageIcon className="size-4" />
          Ver imagen
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPreviewVideo(postcard)} disabled={!postcard.video_url}>
          <Play className="size-4" />
          Ver video
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={postcard.arLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Abrir experiencia AR
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Compartir</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onCopyLink(postcard)}>
          <LinkIcon className="size-4" />
          Copiar enlace AR
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(postcard, 'image')} disabled={!postcard.image_url}>
          <Download className="size-4" />
          Descargar imagen
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(postcard, 'video')} disabled={!postcard.video_url}>
          <Download className="size-4" />
          Descargar video
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Editar</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onEditImage(postcard)}>
          <ImageIcon className="size-4" />
          Cambiar imagen
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEditVideo(postcard)}>
          <Video className="size-4" />
          Cambiar video
        </DropdownMenuItem>

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(postcard)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Eliminar postal
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface QuickActionsProps {
  postcard: AdminPostcard;
  onCopyLink: (p: AdminPostcard) => void;
  copied: boolean;
}

export function QuickViewLink({ postcard, onCopyLink, copied }: QuickActionsProps) {
  return (
    <button
      type="button"
      onClick={() => onCopyLink(postcard)}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title={postcard.arLink}
    >
      {copied ? <span className="text-emerald-600 dark:text-emerald-400">Copiado</span> : (
        <>
          <Eye className="size-3" />
          Copiar enlace AR
        </>
      )}
    </button>
  );
}
