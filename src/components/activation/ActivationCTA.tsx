'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Truck, Loader2 } from 'lucide-react';
import { ColorSelector } from './ColorSelector';
import type { VariantColor } from '@/lib/shopify/constants';
import { toast } from 'sonner';

interface ActivationCTAProps {
  postcardId: string;
}

const DIGITAL_PRICE = '$15.000 COP';
const PHYSICAL_PRICE = '$30.000 COP';

export function ActivationCTA({ postcardId }: ActivationCTAProps) {
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

  return (
    <Card className="p-5 bg-linear-to-br from-primary/5 via-card to-ring/5 border-primary/20 rounded-2xl">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Activa tu postal</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Elige cómo quieres recibir tu experiencia de realidad aumentada.
      </p>

      <div className="flex flex-col gap-3">
        {/* Postal física - opción destacada */}
        <div className="rounded-xl border-2 border-primary/40 bg-card p-4 flex flex-col relative">
          <div className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Truck className="h-2.5 w-2.5" /> Recomendado
          </div>
          <div className="flex items-baseline justify-between gap-2 mb-1 mt-1">
            <h3 className="font-semibold text-sm">Postal física + AR</h3>
            <p className="text-lg font-bold text-foreground whitespace-nowrap">{PHYSICAL_PRICE}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Imprimimos y enviamos tu postal a la dirección que indiques. Activamos el AR automáticamente.
          </p>
          <div className="mb-3">
            <p className="text-[11px] text-muted-foreground mb-1.5">Color de la postal:</p>
            <ColorSelector value={color} onChange={setColor} />
          </div>
          <Button
            onClick={() => startCheckout('physical')}
            disabled={loadingType !== null}
            className="w-full h-9"
            size="sm"
          >
            {loadingType === 'physical' ? (
              <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Redirigiendo...</>
            ) : (
              'Comprar postal'
            )}
          </Button>
        </div>

        {/* Separador con O */}
        <div className="flex items-center gap-2 my-0.5">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">O</span>
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* Solo digital - opción secundaria */}
        <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm">Solo digital</h3>
            <p className="text-lg font-bold text-foreground whitespace-nowrap">{DIGITAL_PRICE}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Activa el AR y tú imprimes la foto donde quieras. Compártela inmediatamente.
          </p>
          <Button
            onClick={() => startCheckout('digital')}
            disabled={loadingType !== null}
            className="w-full h-9"
            size="sm"
            variant="outline"
          >
            {loadingType === 'digital' ? (
              <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Redirigiendo...</>
            ) : (
              'Activar digital'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
