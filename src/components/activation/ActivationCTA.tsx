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
    <Card className="p-6 bg-linear-to-br from-primary/5 via-card to-ring/5 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Activa tu postal</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Elige cómo quieres recibir tu experiencia de realidad aumentada.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
          <h3 className="font-semibold text-base mb-1">Solo digital</h3>
          <p className="text-2xl font-bold text-foreground mb-2">{DIGITAL_PRICE}</p>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            Activa el AR y tú imprimes la foto donde quieras. Compártela inmediatamente.
          </p>
          <Button
            onClick={() => startCheckout('digital')}
            disabled={loadingType !== null}
            className="w-full"
          >
            {loadingType === 'digital' ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo...</>
            ) : (
              'Activar'
            )}
          </Button>
        </div>

        <div className="rounded-xl border-2 border-primary/40 bg-card p-5 flex flex-col relative">
          <div className="absolute -top-2 right-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Truck className="h-3 w-3" /> Recomendado
          </div>
          <h3 className="font-semibold text-base mb-1">Postal física + AR</h3>
          <p className="text-2xl font-bold text-foreground mb-2">{PHYSICAL_PRICE}</p>
          <p className="text-sm text-muted-foreground mb-4">
            Imprimimos y enviamos tu postal a la dirección que indiques. Activamos el AR automáticamente.
          </p>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Color de la postal:</p>
            <ColorSelector value={color} onChange={setColor} />
          </div>
          <Button
            onClick={() => startCheckout('physical')}
            disabled={loadingType !== null}
            className="w-full"
            variant="default"
          >
            {loadingType === 'physical' ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo...</>
            ) : (
              'Comprar postal'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
