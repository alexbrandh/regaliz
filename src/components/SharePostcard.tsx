'use client';

import { useState } from 'react';
import { Share2, Copy, QrCode, ExternalLink, Check } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useEffect } from 'react';

interface SharePostcardProps {
  postcardId: string;
  title: string;
  className?: string;
}

export function SharePostcard({ postcardId, title, className }: SharePostcardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // URL pública para el visor AR
  const arUrl = `${window.location.origin}/ar/${postcardId}`;

  // Generar QR code cuando se abre el diálogo
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsGeneratingQR(true);
        const arUrl = `${window.location.origin}/ar/${postcardId}`;
        const qrDataUrl = await QRCode.toDataURL(arUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(qrDataUrl);
      } catch (error) {
        console.error('Error generando QR code:', error);
        toast.error('Error al generar código QR');
      } finally {
        setIsGeneratingQR(false);
      }
    };

    if (isOpen && !qrCodeUrl) {
      generateQRCode();
    }
  }, [isOpen, qrCodeUrl, postcardId]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${type} copiado al portapapeles`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      toast.error('Error al copiar al portapapeles');
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Postcard de realidad aumentada: ${title}`,
          text: `¡Mira esta increíble postcard en realidad aumentada!`,
          url: arUrl
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error compartiendo:', error);
          toast.error('Error al compartir');
        }
      }
    } else {
      // Fallback: copiar al portapapeles
      copyToClipboard(arUrl, 'Enlace');
    }
  };

  const downloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `qr-${postcardId}.png`;
      link.href = qrCodeUrl;
      link.click();
      toast.success('Código QR descargado');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={className}
          onClick={(e) => e.stopPropagation()}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Compartir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir Postcard de realidad aumentada</DialogTitle>
          <DialogDescription>
            Comparte tu postcard en realidad aumentada con otros
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Botón de compartir nativo */}
          <div className="flex flex-col space-y-2">
            <Label>Compartir directamente</Label>
            <Button onClick={shareNative} className="w-full">
              <Share2 className="h-4 w-4 mr-2" />
              {typeof navigator !== 'undefined' && 'share' in navigator ? 'Compartir' : 'Copiar enlace'}
            </Button>
          </div>

          {/* URL del visor AR */}
          <div className="flex flex-col space-y-2">
            <Label htmlFor="ar-url">Enlace del visor de realidad aumentada</Label>
            <div className="flex space-x-2">
              <Input
                id="ar-url"
                value={arUrl}
                readOnly
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(arUrl, 'Enlace de realidad aumentada')}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(arUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Código QR */}
          <div className="flex flex-col space-y-2">
            <Label>Código QR</Label>
            <div className="flex flex-col items-center space-y-3">
              {isGeneratingQR ? (
                <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : qrCodeUrl ? (
                <Image
                  src={qrCodeUrl}
                  alt="Código QR"
                  width={256}
                  height={256}
                  className="border rounded-lg"
                  unoptimized
                />
              ) : (
                <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                  <QrCode className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
              
              {qrCodeUrl && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadQR}
                  >
                    Descargar QR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(arUrl, 'Enlace QR')}
                  >
                    Copiar enlace
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Instrucciones */}
          <div className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg">
            <p className="font-medium mb-1">💡 Cómo usar:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Comparte el enlace o código QR con otros</li>
              <li>Abre el enlace en un dispositivo móvil</li>
              <li>Permite el acceso a la cámara</li>
              <li>Apunta la cámara hacia la imagen de la postcard</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}