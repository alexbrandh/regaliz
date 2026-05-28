'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sparkles,
  Truck,
  Loader2,
  Package,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Share2,
  QrCode,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VariantColor } from '@/lib/shopify/constants';
import { toast } from 'sonner';

interface ActivationCTAProps {
  postcardId: string;
  postcardTitle?: string;
  imageUrl?: string;
}

const DIGITAL_PRICE = '$15.000';
const PHYSICAL_PRICE = '$30.000';
const CURRENCY = 'COP';

const COLOR_SWATCHES: Record<
  VariantColor,
  { label: string; bg: string; cardBg: string; cardBorder: string; textOnCard: string }
> = {
  beige: {
    label: 'Beige',
    bg: '#E8D5B7',
    cardBg: '#EFD9B4',
    cardBorder: '#C9B086',
    textOnCard: '#3A2D1A',
  },
  negro: {
    label: 'Negro',
    bg: '#1a1a1a',
    cardBg: '#161616',
    cardBorder: '#3a3a3a',
    textOnCard: '#F5E6C8',
  },
};

export function ActivationCTA({ postcardId, postcardTitle, imageUrl }: ActivationCTAProps) {
  const [mode, setMode] = useState<'physical' | 'digital'>('physical');
  const [color, setColor] = useState<VariantColor>('beige');
  const [loadingType, setLoadingType] = useState<'digital' | 'physical' | null>(null);

  const startCheckout = async (productType: 'digital' | 'physical') => {
    setLoadingType(productType);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcardId,
          productType,
          ...(productType === 'physical' ? { variantColor: color } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No pudimos iniciar el pago');
        return;
      }

      window.location.assign(data.checkoutUrl);
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Error de red. Inténtalo de nuevo.');
    } finally {
      setLoadingType(null);
    }
  };

  const swatch = COLOR_SWATCHES[color];

  return (
    <Card className="overflow-hidden rounded-3xl border-primary/20 bg-linear-to-br from-primary/[0.04] via-card to-ring/[0.04] shadow-xl shadow-primary/5">
      {/* Header */}
      <div className="px-6 md:px-10 pt-7 md:pt-10 pb-5 md:pb-6 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 mb-3">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Falta un paso
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Activa tu postal en realidad aumentada
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mt-1.5 max-w-xl">
              Elige cómo quieres recibir tu experiencia. El pago es único, sin suscripciones.
            </p>
          </div>

          {/* Mode switcher (segmented) */}
          <div className="inline-flex shrink-0 self-start sm:self-end rounded-full bg-muted/40 border border-border/60 p-1">
            <button
              type="button"
              onClick={() => setMode('physical')}
              className={cn(
                'flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all',
                mode === 'physical'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={mode === 'physical'}
            >
              <Package className="h-3.5 w-3.5" />
              Postal física + AR
            </button>
            <button
              type="button"
              onClick={() => setMode('digital')}
              className={cn(
                'flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all',
                mode === 'digital'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={mode === 'digital'}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Solo digital
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 p-6 md:p-10">
        {/* Visual: physical mockup OR digital phone */}
        <div className="order-2 lg:order-1">
          {mode === 'physical' ? (
            <PhysicalMockup
              imageUrl={imageUrl}
              postcardTitle={postcardTitle}
              swatch={swatch}
            />
          ) : (
            <DigitalMockup imageUrl={imageUrl} postcardTitle={postcardTitle} />
          )}
        </div>

        {/* Details */}
        <div className="order-1 lg:order-2 flex flex-col">
          {mode === 'physical' ? (
            <>
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 mb-3">
                <Truck className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
                  Más popular · Envío incluido
                </span>
              </div>

              <h3 className="text-xl md:text-2xl font-bold mb-1">
                Postal física impresa + AR
              </h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Imprimimos tu postal en cartulina premium y la enviamos a la dirección que indiques. El AR queda activado y listo para escanear.
              </p>

              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-4xl md:text-5xl font-bold tracking-tight">
                  {PHYSICAL_PRICE}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{CURRENCY}</span>
                <span className="text-xs text-muted-foreground ml-1">· pago único</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                <Benefit icon={<Package className="h-4 w-4" />} text="Postal física en cartulina premium" />
                <Benefit icon={<Truck className="h-4 w-4" />} text="Envío a domicilio incluido en Colombia" />
                <Benefit icon={<QrCode className="h-4 w-4" />} text="QR pre-impreso para activar la AR" />
                <Benefit icon={<Zap className="h-4 w-4" />} text="AR activado automáticamente" />
              </ul>

              {/* Color selector */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                  Color de la postal
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(COLOR_SWATCHES) as VariantColor[]).map((c) => {
                    const s = COLOR_SWATCHES[c];
                    const selected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={cn(
                          'group relative flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all',
                          selected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-card/60 hover:border-primary/40',
                        )}
                        aria-pressed={selected}
                      >
                        <span
                          className="relative inline-flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-border/60 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: s.bg }}
                        >
                          {selected && (
                            <CheckCircle2
                              className="h-4 w-4"
                              style={{
                                color: c === 'negro' ? '#F5E6C8' : '#3A2D1A',
                              }}
                            />
                          )}
                        </span>
                        <span className="text-sm font-semibold">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={() => startCheckout('physical')}
                disabled={loadingType !== null}
                size="lg"
                className="w-full h-14 text-base font-semibold bg-linear-to-r from-primary to-ring hover:from-primary/90 hover:to-ring/90 shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all"
              >
                {loadingType === 'physical' ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Redirigiendo al pago seguro...
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5 mr-2" />
                    Comprar mi postal · {PHYSICAL_PRICE}
                  </>
                )}
              </Button>

              <TrustSignals />
            </>
          ) : (
            <>
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 mb-3">
                <Zap className="h-3 w-3 text-sky-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-500">
                  Activación inmediata
                </span>
              </div>

              <h3 className="text-xl md:text-2xl font-bold mb-1">
                Solo activación digital
              </h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Activamos tu AR al instante. Comparte el enlace o el QR con quien tú quieras e imprime la foto donde prefieras.
              </p>

              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-4xl md:text-5xl font-bold tracking-tight">
                  {DIGITAL_PRICE}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{CURRENCY}</span>
                <span className="text-xs text-muted-foreground ml-1">· pago único</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                <Benefit icon={<Zap className="h-4 w-4" />} text="Activación inmediata al pagar" />
                <Benefit icon={<Share2 className="h-4 w-4" />} text="Comparte por WhatsApp, link o QR" />
                <Benefit icon={<Smartphone className="h-4 w-4" />} text="Funciona desde cualquier celular" />
                <Benefit icon={<QrCode className="h-4 w-4" />} text="QR descargable para imprimir tú mismo" />
              </ul>

              <Button
                onClick={() => startCheckout('digital')}
                disabled={loadingType !== null}
                size="lg"
                className="w-full h-14 text-base font-semibold bg-linear-to-r from-primary to-ring hover:from-primary/90 hover:to-ring/90 shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all"
              >
                {loadingType === 'digital' ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Redirigiendo al pago seguro...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Activar ahora · {DIGITAL_PRICE}
                  </>
                )}
              </Button>

              <TrustSignals />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-foreground/90 leading-relaxed">{text}</span>
    </li>
  );
}

function TrustSignals() {
  return (
    <div className="mt-5 pt-5 border-t border-border/50 grid grid-cols-3 gap-3 text-[11px] text-muted-foreground">
      <div className="flex flex-col items-center text-center gap-1">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>Pago seguro</span>
      </div>
      <div className="flex flex-col items-center text-center gap-1">
        <CreditCard className="h-4 w-4 text-sky-500" />
        <span>Tarjeta, PSE o Nequi</span>
      </div>
      <div className="flex flex-col items-center text-center gap-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Activación garantizada</span>
      </div>
    </div>
  );
}

function PhysicalMockup({
  imageUrl,
  postcardTitle,
  swatch,
}: {
  imageUrl?: string;
  postcardTitle?: string;
  swatch: (typeof COLOR_SWATCHES)[VariantColor];
}) {
  return (
    <div className="relative">
      {/* Floating tag */}
      <div className="absolute -top-2 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-2.5 py-1 shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          Vista previa
        </span>
      </div>

      {/* Postcard mockup */}
      <div
        className="relative aspect-[4/5] w-full max-w-md mx-auto rounded-3xl shadow-2xl transition-all duration-500 ease-out"
        style={{
          background: swatch.cardBg,
          border: `1px solid ${swatch.cardBorder}`,
        }}
      >
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 0%, rgba(255,255,255,0.15), transparent 50%), radial-gradient(circle at 80% 100%, rgba(0,0,0,0.15), transparent 50%)',
          }}
        />

        {/* Inner content */}
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col">
          {/* Photo frame */}
          <div className="relative flex-1 mb-4 rounded-xl overflow-hidden bg-white/95 shadow-lg ring-1 ring-black/10 p-2">
            {imageUrl ? (
              <div className="relative h-full w-full rounded-md overflow-hidden">
                <Image
                  src={imageUrl}
                  alt={postcardTitle || 'Tu postal'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 90vw, 400px"
                />
              </div>
            ) : (
              <div className="h-full w-full rounded-md bg-muted/40 flex items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Footer of postcard: title + QR */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-70"
                style={{ color: swatch.textOnCard }}
              >
                Regaliz · AR
              </p>
              <p
                className="text-base md:text-lg font-bold truncate"
                style={{ color: swatch.textOnCard }}
              >
                {postcardTitle || 'Tu postal AR'}
              </p>
            </div>
            {/* Mini QR placeholder */}
            <div className="shrink-0 h-12 w-12 md:h-14 md:w-14 rounded-md bg-white/95 p-1 shadow-md ring-1 ring-black/10 flex items-center justify-center">
              <QrCode className="h-full w-full text-black/80" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </div>

      {/* Caption below mockup */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Mockup ilustrativo · El producto final puede variar ligeramente
      </p>
    </div>
  );
}

function DigitalMockup({
  imageUrl,
  postcardTitle,
}: {
  imageUrl?: string;
  postcardTitle?: string;
}) {
  return (
    <div className="relative">
      <div className="absolute -top-2 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-2.5 py-1 shadow-lg">
        <Smartphone className="h-3 w-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          Experiencia digital
        </span>
      </div>

      {/* Phone frame */}
      <div className="relative mx-auto w-full max-w-[280px] aspect-[9/19] rounded-[2.5rem] bg-foreground p-2 shadow-2xl">
        <div className="relative h-full w-full rounded-[2rem] overflow-hidden bg-black">
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={postcardTitle || 'Tu postal'}
                fill
                className="object-cover"
                sizes="280px"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="h-full w-full bg-muted/20" />
          )}

          {/* Phone notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-20 rounded-full bg-foreground z-10" />

          {/* AR badge floating */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary/90 backdrop-blur-md text-primary-foreground px-3 py-1.5 shadow-lg">
            <Sparkles className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              AR activo
            </span>
          </div>

          {/* Bottom content */}
          <div className="absolute bottom-0 inset-x-0 p-4 text-white">
            <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">
              Regaliz · AR
            </p>
            <p className="text-sm font-bold truncate">
              {postcardTitle || 'Tu postal AR'}
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Comparte por link o QR · Funciona en cualquier celular
      </p>
    </div>
  );
}
