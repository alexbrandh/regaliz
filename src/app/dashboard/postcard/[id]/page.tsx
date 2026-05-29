'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Download,
  Eye,
  Video,
  Image as ImageIcon,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Share2,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import QRCode from 'qrcode';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { isValidImageUrl, handleImageError } from '@/lib/url-utils';
import { ActivationCTA } from '@/components/activation/ActivationCTA';
import { PostPurchaseSuccess } from '@/components/activation/PostPurchaseSuccess';

type PostcardStatus = 'processing' | 'ready' | 'error' | 'needs_better_image';

interface Postcard {
  id: string;
  title: string;
  description: string;
  image_url: string;
  video_url: string;
  video_path?: string;
  user_id?: string;
  status: PostcardStatus;
  created_at: string;
  is_activated?: boolean;
  fulfillment_type?: 'digital' | 'physical' | null;
}

const STATUS_TEXT: Record<PostcardStatus, string> = {
  processing: 'Procesando',
  ready: 'Listo',
  error: 'Error',
  needs_better_image: 'Necesita mejor imagen',
};

export default function PostcardDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [postcard, setPostcard] = useState<Postcard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQrDialog, setShowQrDialog] = useState(false);

  const postcardId = params?.id as string;

  const justPaid = searchParams?.get('just_paid') === 'true';
  const [showSuccess, setShowSuccess] = useState(justPaid);

  const dismissSuccess = () => {
    setShowSuccess(false);
    // Limpiar el query param sin recargar
    router.replace(`/dashboard/postcard/${postcardId}`);
    // Refetch para tomar el is_activated actualizado
    if (postcardId) {
      fetch(`/api/postcards/${postcardId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) setPostcard(res.data);
        });
    }
  };

  // postcard.video_url comes back from /api/postcards/[id] as a fresh signed
  // URL (https://<project>.supabase.co/storage/v1/object/sign/postcard-videos/
  // <storage-key>?token=...). Peel the storage key out of it so useSignedUrl
  // can re-sign on expiry. Rebuilding the key from postcard.user_id breaks
  // for pre-migration postcards: the trigger remaps user_id to the new
  // Supabase UUID, but the file is still under the original Clerk-prefixed
  // folder.
  const videoPath = (() => {
    if (!postcard?.video_url) return '';
    const marker = '/postcard-videos/';
    const idx = postcard.video_url.indexOf(marker);
    if (idx >= 0) {
      return postcard.video_url.slice(idx + marker.length).split('?')[0];
    }
    // Older rows stored the raw key directly instead of a signed URL.
    return postcard.video_url.split('?')[0];
  })();

  const {
    signedUrl: videoSignedUrl,
    loading: videoUrlLoading,
    error: videoUrlError,
  } = useSignedUrl({
    bucket: 'postcard-videos',
    path: videoPath,
    expiresIn: 3600,
    enabled: !!videoPath && postcard?.status === 'ready',
  });

  useEffect(() => {
    if (!postcardId) return;

    const fetchPostcard = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/postcards/${postcardId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to fetch postcard');
        }

        if (data.success) {
          setPostcard(data.data);
        } else {
          throw new Error(data.error?.message || 'Failed to fetch postcard');
        }
      } catch (err) {
        console.error('Error fetching postcard:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch postcard');
      } finally {
        setLoading(false);
      }
    };

    fetchPostcard();
  }, [postcardId]);

  useEffect(() => {
    if (postcard && postcard.status === 'ready') {
      const arUrl = `${window.location.origin}/ar/${postcard.id}`;
      QRCode.toDataURL(arUrl, {
        width: 512,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, [postcard]);

  const handleShare = async (type: 'copy' | 'qr' | 'whatsapp' | 'twitter') => {
    if (!postcard) return;
    const url = `${window.location.origin}/ar/${postcard.id}`;

    switch (type) {
      case 'copy':
        await navigator.clipboard.writeText(url);
        toast.success('Enlace copiado al portapapeles');
        break;
      case 'qr':
        setShowQrDialog(true);
        break;
      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`¡Mira mi postal en realidad aumentada! ${url}`)}`,
          '_blank',
        );
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(`¡Mira mi postal en realidad aumentada! ${url}`)}`,
          '_blank',
        );
        break;
    }
  };

  const handleDownload = async (kind: 'image' | 'video') => {
    if (!postcard) return;

    if (kind === 'video' && postcard.video_url) {
      const link = document.createElement('a');
      link.href = postcard.video_url;
      link.download = `${postcard.title || 'postal'}-video.mp4`;
      link.click();
      return;
    }

    if (kind !== 'image' || !postcard.image_url) return;

    const baseName = postcard.title || 'postal';

    if (!qrCodeUrl) {
      const link = document.createElement('a');
      link.href = postcard.image_url;
      link.download = `${baseName}-imagen.jpg`;
      link.click();
      return;
    }

    const toastId = toast.loading('Preparando imagen con QR...');
    try {
      const blobUrl = await composeTargetWithQr(
        postcard.image_url,
        qrCodeUrl,
        baseName,
      );
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${baseName}-imagen-qr.jpg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      toast.success('Imagen lista', { id: toastId });
    } catch (err) {
      console.error('Error composing target with QR, falling back to raw image:', err);
      const link = document.createElement('a');
      link.href = postcard.image_url;
      link.download = `${baseName}-imagen.jpg`;
      link.click();
      toast.error('No pudimos generar la imagen con QR, descargamos la original', {
        id: toastId,
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Cargando postal...</p>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="min-h-screen">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-5 max-w-md">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-foreground">Error al cargar la postal</h3>
                  <p className="text-muted-foreground text-sm">{error}</p>
                </div>
                <Link href="/dashboard">
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!postcard) {
    return (
      <MainLayout>
        <div className="min-h-screen">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-5 max-w-md">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-foreground">Postal no encontrada</h3>
                  <p className="text-muted-foreground text-sm">
                    La postal que buscas no existe o no está disponible.
                  </p>
                </div>
                <Link href="/dashboard">
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const isReady = postcard.status === 'ready';
  const formattedDate = new Date(postcard.created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <MainLayout>
      <TooltipProvider delayDuration={150}>
        <div className="min-h-screen">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-10 max-w-7xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
              <Link
                href="/dashboard"
                className="hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              <span className="text-foreground/80 truncate max-w-[200px]">
                {postcard.title || 'Postal sin título'}
              </span>
            </nav>

            {/* Header hero */}
            <header className="mb-8 md:mb-10">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                      {postcard.title || 'Postal sin título'}
                    </h1>
                    <StatusPill status={postcard.status} />
                  </div>
                  {postcard.description && (
                    <p className="text-muted-foreground max-w-2xl leading-relaxed">
                      {postcard.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80 pt-1">
                    Creada el {formattedDate}
                  </p>
                </div>
              </div>
            </header>

            {(() => {
              const needsActivation =
                postcard.status === 'ready' && !postcard.is_activated;
              const canDownload = isReady && !!postcard.is_activated;

              const imageTarget = (
                <MediaCard
                  label="Imagen Target"
                  icon={<ImageIcon className="h-4 w-4" />}
                  downloadAction={
                    canDownload && postcard.image_url
                      ? () => handleDownload('image')
                      : undefined
                  }
                  downloadLabel="Descargar imagen con QR"
                >
                  <div
                    className={`relative ${needsActivation ? 'h-[280px] md:h-[320px]' : 'h-[380px] md:h-[440px]'} overflow-hidden`}
                  >
                    {postcard.image_url && isValidImageUrl(postcard.image_url) ? (
                      <>
                        <Image
                          src={postcard.image_url}
                          alt=""
                          fill
                          aria-hidden="true"
                          className="object-cover scale-110 blur-2xl opacity-40"
                        />
                        <div className="absolute inset-0 bg-black/20" />
                        <Image
                          src={postcard.image_url}
                          alt={postcard.title || 'Imagen de la postal'}
                          fill
                          className="object-contain"
                          onError={(e) =>
                            handleImageError(postcard.image_url, e.target as HTMLImageElement)
                          }
                        />
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full bg-muted/30">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </MediaCard>
              );

              const videoBlock = (
                <MediaCard
                  label="Video de realidad aumentada"
                  icon={<Video className="h-4 w-4" />}
                  downloadAction={
                    canDownload && postcard.video_url
                      ? () => handleDownload('video')
                      : undefined
                  }
                  downloadLabel="Descargar video"
                >
                  <div
                    className={`relative ${needsActivation ? 'h-[280px] md:h-[320px]' : 'h-[380px] md:h-[440px]'} bg-black overflow-hidden`}
                  >
                    {postcard.video_url ? (
                      <>
                        <video
                          controls
                          preload="metadata"
                          playsInline
                          muted
                          crossOrigin="anonymous"
                          className="w-full h-full object-contain"
                        >
                          <source
                            src={videoSignedUrl || postcard.video_url}
                            type="video/mp4"
                          />
                          Tu navegador no soporta el elemento de video.
                        </video>
                        {videoUrlLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                        {videoUrlError && (
                          <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 p-4 pointer-events-none">
                            <p className="text-destructive text-sm text-center">
                              Error cargando video
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Video className="h-16 w-16 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </MediaCard>
              );

              if (needsActivation) {
                return (
                  <div className="space-y-5 lg:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                      {imageTarget}
                      {videoBlock}
                    </div>
                    <ActivationCTA
                      postcardId={postcard.id}
                      postcardTitle={postcard.title}
                      imageUrl={postcard.image_url}
                    />
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                  <div className="lg:col-span-5">{imageTarget}</div>
                  <div className="lg:col-span-4">{videoBlock}</div>
                  <div className="lg:col-span-3">
                    <ActionPanel
                      isReady={isReady}
                      status={postcard.status}
                      postcardId={postcard.id}
                      qrCodeUrl={qrCodeUrl}
                      hasImage={!!postcard.image_url}
                      hasVideo={!!postcard.video_url}
                      onShare={handleShare}
                      onDownload={handleDownload}
                      onOpenQrDialog={() => setShowQrDialog(true)}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* QR Dialog */}
          <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Código QR para Realidad Aumentada</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4 py-2">
                {qrCodeUrl && (
                  <div className="p-4 bg-white rounded-2xl shadow-sm">
                    <Image
                      src={qrCodeUrl}
                      alt="Código QR para realidad aumentada"
                      width={280}
                      height={280}
                      className="rounded-md"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Escanea con la cámara de tu teléfono para abrir la experiencia de realidad aumentada directamente.
                </p>
                <div className="flex gap-2 w-full">
                  <Button onClick={() => handleShare('copy')} variant="outline" className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar enlace
                  </Button>
                  <Button
                    onClick={() => {
                      if (qrCodeUrl) {
                        const link = document.createElement('a');
                        link.href = qrCodeUrl;
                        link.download = `qr-${postcard.title || 'postal'}.png`;
                        link.click();
                      }
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {showSuccess && (
            <PostPurchaseSuccess postcardId={postcardId} onDismiss={dismissSuccess} />
          )}
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}

/* ----- Subcomponentes ----- */

function StatusPill({ status }: { status: PostcardStatus }) {
  const config = {
    ready: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
      dot: 'bg-emerald-500',
      pulse: false,
    },
    processing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      classes: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      dot: 'bg-amber-500',
      pulse: true,
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      classes: 'bg-destructive/15 text-destructive border-destructive/30',
      dot: 'bg-destructive',
      pulse: false,
    },
    needs_better_image: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      classes: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      dot: 'bg-amber-500',
      pulse: false,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.classes}`}
    >
      <span className="relative inline-flex h-2 w-2">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${config.dot}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
      </span>
      {STATUS_TEXT[status]}
    </span>
  );
}

function MediaCard({
  label,
  icon,
  children,
  downloadAction,
  downloadLabel,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  downloadAction?: () => void;
  downloadLabel?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow rounded-2xl p-0">
      <CardContent className="p-0 relative">
        {children}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium border border-white/10 z-10">
          {icon}
          {label}
        </div>
        {downloadAction && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={downloadAction}
                aria-label={downloadLabel ?? 'Descargar'}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all z-10"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Descargar</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{downloadLabel ?? 'Descargar'}</TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}

interface ActionPanelProps {
  isReady: boolean;
  status: PostcardStatus;
  postcardId: string;
  qrCodeUrl: string;
  hasImage: boolean;
  hasVideo: boolean;
  onShare: (type: 'copy' | 'qr' | 'whatsapp' | 'twitter') => void;
  onDownload: (kind: 'image' | 'video') => void;
  onOpenQrDialog: () => void;
}

function ActionPanel({
  isReady,
  status,
  postcardId,
  qrCodeUrl,
  hasImage,
  hasVideo,
  onShare,
  onDownload,
  onOpenQrDialog,
}: ActionPanelProps) {
  if (!isReady) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5 rounded-2xl h-full">
        <CardContent className="p-5 flex flex-col gap-4 h-full">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              {status === 'processing' ? (
                <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
              ) : status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="font-semibold text-foreground">
                {status === 'processing' && 'Procesando tu postal'}
                {status === 'error' && 'Hubo un error'}
                {status === 'needs_better_image' && 'La imagen no es óptima'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {status === 'processing' &&
                  'Estamos generando la experiencia de realidad aumentada. Esto puede tomar unos minutos.'}
                {status === 'error' &&
                  'No pudimos procesar tu postal. Intenta crearla nuevamente.'}
                {status === 'needs_better_image' &&
                  'La imagen necesita más contraste o detalles para funcionar bien en realidad aumentada.'}
              </p>
            </div>
          </div>
          <Button disabled variant="outline" className="w-full opacity-50">
            <Eye className="mr-2 h-4 w-4" />
            Realidad aumentada no disponible aún
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur-sm rounded-2xl h-full overflow-hidden">
      <CardContent className="p-5 space-y-5">
        {/* QR embebido */}
        {qrCodeUrl && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Escanea para realidad aumentada
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenQrDialog}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Ampliar QR"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Ampliar</TooltipContent>
              </Tooltip>
            </div>
            <button
              onClick={onOpenQrDialog}
              className="w-full p-3 bg-white rounded-xl border border-border/60 hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <Image
                src={qrCodeUrl}
                alt="Código QR para realidad aumentada"
                width={200}
                height={200}
                className="w-full h-auto rounded-md group-hover:scale-[1.02] transition-transform"
              />
            </button>
          </div>
        )}

        {/* CTA principal AR */}
        <Link href={`/ar/${postcardId}`} className="block">
          <Button
            size="lg"
            className="w-full bg-linear-to-r from-primary to-ring hover:from-primary/90 hover:to-ring/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all h-12"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Ver en realidad aumentada
          </Button>
        </Link>

        <Separator />

        {/* Compartir */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Share2 className="h-3 w-3" />
            Compartir
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            <IconAction
              onClick={() => onShare('copy')}
              label="Copiar enlace"
              icon={<Copy className="h-4 w-4" />}
            />
            <IconAction
              onClick={() => onShare('qr')}
              label="Código QR"
              icon={<QrCode className="h-4 w-4" />}
            />
            <IconAction
              onClick={() => onShare('whatsapp')}
              label="WhatsApp"
              icon={<WhatsAppIcon className="h-4 w-4" />}
              className="text-emerald-500 hover:text-emerald-400"
            />
            <IconAction
              onClick={() => onShare('twitter')}
              label="X (Twitter)"
              icon={<TwitterIcon className="h-4 w-4" />}
              className="text-sky-400 hover:text-sky-300"
            />
          </div>
        </div>

        {/* Descargar */}
        {(hasImage || hasVideo) && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="h-3 w-3" />
                  Descargar archivos
                </h3>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  La imagen se descarga con el código QR incluido, lista para imprimir y activar la realidad aumentada.
                </p>
              </div>
              <div className="space-y-1.5">
                {hasImage && (
                  <Button
                    onClick={() => onDownload('image')}
                    variant="outline"
                    className="w-full justify-start gap-2 h-11 font-medium border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-foreground"
                  >
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-left">Descargar imagen con QR</span>
                    <Download className="h-4 w-4 opacity-60" />
                  </Button>
                )}
                {hasVideo && (
                  <Button
                    onClick={() => onDownload('video')}
                    variant="outline"
                    className="w-full justify-start gap-2 h-11 font-medium border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-foreground"
                  >
                    <Video className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-left">Descargar video</span>
                    <Download className="h-4 w-4 opacity-60" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function IconAction({
  onClick,
  label,
  icon,
  text,
  className = '',
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  text?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className={`flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border/60 bg-background/40 hover:bg-muted hover:border-border transition-all text-foreground/80 hover:text-foreground ${className}`}
        >
          {icon}
          {text && <span className="text-xs font-medium">{text}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function composeTargetWithQr(
  imageUrl: string,
  qrDataUrl: string,
  title: string,
): Promise<string> {
  const [targetImg, qrImg] = await Promise.all([
    loadImage(imageUrl, true),
    loadImage(qrDataUrl, false),
  ]);

  const W = targetImg.naturalWidth;
  const targetH = targetImg.naturalHeight;
  const padding = Math.round(W * 0.04);
  const qrSize = Math.round(W * 0.32);
  const captionGap = Math.round(W * 0.025);
  const captionSize = Math.round(W * 0.028);
  const subCaptionSize = Math.round(W * 0.022);
  const stripH = qrSize + captionGap + captionSize + captionGap + subCaptionSize + padding;

  const canvas = document.createElement('canvas');
  canvas.width = W + padding * 2;
  canvas.height = padding + targetH + stripH + padding;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context available');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(targetImg, padding, padding, W, targetH);

  const sepY = padding + targetH + Math.round(padding * 0.6);
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = Math.max(1, Math.round(W * 0.0015));
  ctx.beginPath();
  ctx.moveTo(padding, sepY);
  ctx.lineTo(padding + W, sepY);
  ctx.stroke();

  const qrX = (canvas.width - qrSize) / 2;
  const qrY = sepY + Math.round(padding * 0.6);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#111827';
  ctx.font = `600 ${captionSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    'Escanea para ver en realidad aumentada',
    canvas.width / 2,
    qrY + qrSize + captionGap,
  );

  if (title) {
    ctx.fillStyle = '#6B7280';
    ctx.font = `400 ${subCaptionSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillText(
      title,
      canvas.width / 2,
      qrY + qrSize + captionGap + captionSize + captionGap,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('canvas.toBlob returned null'));
        resolve(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.92,
    );
  });
}
