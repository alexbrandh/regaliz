'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  ArrowLeft, Copy, Check, ExternalLink, Mail, Calendar, Eye,
  ImageIcon, Video, Download, Trash2, RefreshCw, Loader2, Edit2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api, type AdminPostcard } from '@/lib/admin/api';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/admin/postcards/StatusBadge';
import { EditMediaModal } from '@/components/admin/postcards/EditMediaModal';
import { PreviewModal } from '@/components/admin/postcards/PreviewModal';
import { ConfirmDialog } from '@/components/admin/postcards/ConfirmDialog';
import { Skeleton } from '@/components/admin/common/Skeleton';
import { formatDate, initials, relativeTime } from '@/lib/admin/format';

interface DetailData extends AdminPostcard {
  timeline: Array<{ type: string; at: string; meta?: unknown }>;
}

const TIMELINE_LABELS: Record<string, string> = {
  created: 'Postal creada',
  updated: 'Postal actualizada',
  first_view: 'Primera vista de realidad aumentada',
  last_view: 'Última vista de realidad aumentada',
};

export default function PostcardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editType, setEditType] = useState<'image' | 'video' | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const res = await api.getPostcard(id);
    if (res.success && res.data) {
      setData(res.data as DetailData);
      try {
        const qr = await QRCode.toDataURL(res.data.arLink, { width: 256, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff' } });
        setQrSrc(qr);
      } catch {
        // noop
      }
    } else {
      toast({ title: 'Error', description: res.error || 'No se pudo cargar la postal', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const copy = (text: string, label = 'Copiado al portapapeles') => {
    void navigator.clipboard.writeText(text.replace(/\s+/g, '').trim());
    setCopied(true);
    toast({ title: label });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await api.deletePostcard(id);
    setDeleting(false);
    if (res.success) {
      toast({ title: 'Postal eliminada' });
      router.push('/admin/postales');
    } else {
      toast({ title: 'No se pudo eliminar', description: res.error, variant: 'destructive' });
      setShowDelete(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-[400px] lg:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  const fullName = data.user.firstName && data.user.lastName
    ? `${data.user.firstName} ${data.user.lastName}`
    : data.user.firstName || data.user.lastName || 'Sin nombre';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/postales"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Postales
        </Link>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{data.title}</h1>
            <StatusBadge status={data.processing_status} />
          </div>
          {data.description && (
            <p className="text-sm text-muted-foreground mt-1">{data.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button asChild size="sm">
            <a href={data.arLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Abrir realidad aumentada
            </a>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MediaCard
              label="Imagen"
              icon={ImageIcon}
              hasMedia={!!data.image_url}
              onPreview={() => setPreviewType('image')}
              onEdit={() => setEditType('image')}
              onDownload={() => downloadFile(data.image_url, `${data.title}-imagen.jpg`)}
            >
              {data.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.image_url}
                  alt="Imagen de la postal"
                  className="size-full object-cover"
                />
              ) : null}
            </MediaCard>

            <MediaCard
              label="Video"
              icon={Video}
              hasMedia={!!data.video_url}
              onPreview={() => setPreviewType('video')}
              onEdit={() => setEditType('video')}
              onDownload={() => downloadFile(data.video_url, `${data.title}-video.mp4`)}
            >
              {data.video_url ? (
                <video
                  src={data.video_url}
                  className="size-full object-cover"
                  muted
                  autoPlay
                  loop
                  playsInline
                />
              ) : null}
            </MediaCard>
          </div>

          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Metadatos</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <MetaRow label="ID">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{data.id}</code>
              </MetaRow>
              <MetaRow label="Creada">{formatDate(data.created_at, { withTime: true })}</MetaRow>
              <MetaRow label="Actualizada">{formatDate(data.updated_at, { withTime: true })}</MetaRow>
              <MetaRow label="Vistas de realidad aumentada totales">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Eye className="size-3.5 text-muted-foreground" />
                  {data.ar_view_count}
                </span>
              </MetaRow>
              <MetaRow label="Pública">{data.is_public ? 'Sí' : 'No'}</MetaRow>
              {data.error_message && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground mb-1">Mensaje de error</dt>
                  <dd className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {data.error_message}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Historial</h2>
            <ol className="relative border-l border-border ml-2 space-y-3">
              {data.timeline.map((evt, i) => (
                <li key={i} className="pl-6 relative">
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <p className="text-sm font-medium">{TIMELINE_LABELS[evt.type] || evt.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(evt.at, { withTime: true })} · {relativeTime(evt.at)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Cliente</h2>
            <div className="flex items-center gap-3">
              {data.user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.user.imageUrl} alt="" className="size-12 rounded-full" />
              ) : (
                <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {initials(data.user.firstName, data.user.lastName, data.user.email)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{data.user.email}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${data.user.email}`}>
                  <Mail className="size-4" />
                  Email
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/usuarios?q=${encodeURIComponent(data.user.email)}`}>
                  Ver perfil
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Enlace de realidad aumentada</h2>
            <div className="bg-muted/40 rounded-lg p-3 mb-3">
              <p className="text-xs font-mono break-all text-muted-foreground">{data.arLink}</p>
            </div>
            <Button onClick={() => copy(data.arLink, 'Enlace copiado')} className="w-full" variant="outline" size="sm">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copiado' : 'Copiar enlace'}
            </Button>
          </div>

          {qrSrc && (
            <div className="bg-card border rounded-xl p-5">
              <h2 className="font-semibold mb-3">QR para compartir</h2>
              <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="QR del enlace de realidad aumentada" className="w-full max-w-[200px]" />
              </div>
              <Button
                onClick={() => downloadFile(qrSrc, `${data.title}-qr.png`)}
                variant="ghost"
                size="sm"
                className="w-full mt-2"
              >
                <Download className="size-4" />
                Descargar QR
              </Button>
            </div>
          )}

          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold text-destructive mb-2">Zona de peligro</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Eliminar la postal removerá también su imagen, video y registros de vistas.
            </p>
            <Button variant="destructive" size="sm" className="w-full" onClick={() => setShowDelete(true)}>
              <Trash2 className="size-4" />
              Eliminar postal
            </Button>
          </div>
        </aside>
      </div>

      <PreviewModal
        postcard={previewType ? data : null}
        type={previewType}
        onClose={() => setPreviewType(null)}
        onDownload={(p, k) => downloadFile(
          k === 'image' ? p.image_url : p.video_url,
          `${p.title}-${k === 'image' ? 'imagen.jpg' : 'video.mp4'}`
        )}
      />

      <EditMediaModal
        postcard={editType ? data : null}
        type={editType}
        onClose={() => setEditType(null)}
        onSaved={() => fetchData()}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="¿Eliminar postal?"
        description={`Se eliminará "${data.title}" junto con todos sus archivos. Esta acción no se puede deshacer.`}
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function MediaCard({
  label,
  icon: Icon,
  hasMedia,
  onPreview,
  onEdit,
  onDownload,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hasMedia: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDownload: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden flex flex-col">
      <div className="aspect-4/3 bg-muted relative flex items-center justify-center">
        {hasMedia ? (
          <button type="button" onClick={onPreview} className="block size-full">
            {children}
          </button>
        ) : (
          <div className="flex flex-col items-center text-muted-foreground gap-2">
            <Icon className="size-8" />
            <p className="text-sm">Sin {label.toLowerCase()}</p>
          </div>
        )}
      </div>
      <div className="p-3 flex items-center justify-between border-t">
        <span className="text-sm font-medium inline-flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {label}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Cambiar">
            <Edit2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDownload}
            disabled={!hasMedia}
            title="Descargar"
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
