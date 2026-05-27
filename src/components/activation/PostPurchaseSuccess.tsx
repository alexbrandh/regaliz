'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostPurchaseSuccessProps {
  postcardId: string;
  onDismiss: () => void;
}

interface PostcardStatus {
  is_activated?: boolean;
  fulfillment_type?: 'digital' | 'physical' | null;
  shipping_address?: { city?: string; address1?: string } | null;
}

export function PostPurchaseSuccess({ postcardId, onDismiss }: PostPurchaseSuccessProps) {
  const [status, setStatus] = useState<'polling' | 'activated' | 'timeout'>('polling');
  const [data, setData] = useState<PostcardStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 15; // 15 * 2s = 30s

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const res = await fetch(`/api/postcards/${postcardId}`, { cache: 'no-store' });
        const json = await res.json();
        const payload = (json?.data ?? json) as PostcardStatus;

        if (payload?.is_activated) {
          if (!cancelled) {
            setData(payload);
            setStatus('activated');
          }
          return;
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setStatus('timeout');
        return;
      }

      setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [postcardId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {status === 'polling' && (
          <>
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Procesando tu pago…</h2>
            <p className="text-sm text-muted-foreground">
              Estamos confirmando con Shopify. Esto toma unos segundos.
            </p>
          </>
        )}

        {status === 'activated' && data && (
          <>
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Postal activada! 🎉</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tu experiencia de realidad aumentada ya está disponible.
            </p>
            {data.fulfillment_type === 'physical' && data.shipping_address && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">
                📦 Tu postal física llegará en 3-5 días hábiles
                {data.shipping_address.city ? ` a ${data.shipping_address.city}` : ''}.
              </p>
            )}
            <Button onClick={onDismiss} className="w-full">
              Continuar
            </Button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">El pago se está procesando</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Está tardando un poco. Refresca esta página en un minuto.
            </p>
            <Button onClick={onDismiss} variant="outline" className="w-full">
              Cerrar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
