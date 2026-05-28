'use client';

import { useRef, useState, useEffect } from 'react';
import { ImageIcon, Video, UploadCloud, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminPostcard } from '@/lib/admin/api';
import { getStoredPassword } from '@/lib/admin/api';
import { compileMindARInBrowser } from '@/lib/admin/mindar-compile';

interface EditMediaModalProps {
  postcard: AdminPostcard | null;
  type: 'image' | 'video' | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditMediaModal({ postcard, type, onClose, onSaved }: EditMediaModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressKind, setProgressKind] = useState<'info' | 'error' | 'success'>('info');

  useEffect(() => {
    if (!postcard || !type) {
      setFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      setProgress('');
      setUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcard?.id, type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!postcard || !type || !file) return;
    setUploading(true);
    setProgressKind('info');
    setProgress(type === 'image' ? 'Paso 1/3: Subiendo imagen...' : 'Subiendo video...');

    try {
      const password = getStoredPassword() || '';

      const formData = new FormData();
      formData.append('password', password);
      formData.append('mediaType', type);
      formData.append('file', file);

      const res = await fetch(`/api/admin/postcards/${postcard.id}/media`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        setProgressKind('error');
        setProgress(`Error: ${data.error}`);
        return;
      }

      if (type !== 'image') {
        setProgressKind('success');
        setProgress('¡Video actualizado!');
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
        return;
      }

      setProgress('Paso 2/3: Compilando target de realidad aumentada... (puede tardar ~20s)');
      const mindBlob = await compileMindARInBrowser(file, pct => {
        setProgress(`Paso 2/3: Compilando realidad aumentada... ${Math.round(pct * 100)}%`);
      });

      setProgress('Paso 3/3: Subiendo target de realidad aumentada...');
      const mindFormData = new FormData();
      mindFormData.append('password', password);
      mindFormData.append('mindFile', mindBlob, 'target.mind');
      mindFormData.append('userId', data.data.userId);

      const mindRes = await fetch(`/api/admin/postcards/${postcard.id}/mind-target`, {
        method: 'POST',
        body: mindFormData,
      });
      const mindData = await mindRes.json();

      if (mindData.success) {
        setProgressKind('success');
        setProgress('¡Imagen y target de realidad aumentada actualizados!');
      } else {
        setProgressKind('error');
        setProgress(`Imagen subida, error en realidad aumentada: ${mindData.error}`);
      }
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1500);
    } catch (err) {
      setProgressKind('error');
      setProgress(`Error: ${err instanceof Error ? err.message : 'Error al subir'}`);
    } finally {
      setUploading(false);
    }
  };

  const open = !!postcard && !!type;
  if (!postcard || !type) return <Dialog open={open} onOpenChange={v => !v && onClose()} />;

  const Icon = type === 'image' ? ImageIcon : Video;

  return (
    <Dialog open={open} onOpenChange={v => !v && !uploading && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-base">
              Cambiar {type === 'image' ? 'imagen' : 'video'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
              {postcard.title}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Archivo actual</p>
            <div className="bg-muted/50 rounded-lg overflow-hidden flex items-center justify-center max-h-32">
              {type === 'image' && postcard.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={postcard.image_url} alt="" className="max-h-32 object-contain" />
              ) : type === 'video' && postcard.video_url ? (
                <video src={postcard.video_url} className="max-h-32" muted autoPlay loop playsInline />
              ) : (
                <div className="py-8 text-muted-foreground text-xs">Sin archivo actual</div>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Nuevo {type === 'image' ? 'imagen' : 'video'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={type === 'image' ? 'image/*' : 'video/*'}
              onChange={handleFileChange}
              className="hidden"
            />

            {preview ? (
              <div className="space-y-2">
                <div className="bg-muted/50 rounded-lg overflow-hidden flex items-center justify-center max-h-48">
                  {type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="max-h-48 object-contain" />
                  ) : (
                    <video src={preview} className="max-h-48" muted autoPlay loop playsInline />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[200px] text-muted-foreground">{file?.name}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    Cambiar archivo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed rounded-lg hover:border-primary/50 hover:bg-accent/30 transition-all flex flex-col items-center gap-2 text-muted-foreground"
              >
                <UploadCloud className="size-7" />
                <span className="text-sm">
                  Selecciona {type === 'image' ? 'una imagen' : 'un video'}
                </span>
                <span className="text-[11px]">
                  {type === 'image' ? 'JPG, PNG, WebP' : 'MP4, MOV'}
                </span>
              </button>
            )}
          </div>

          {type === 'image' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p>
                Al cambiar la imagen se regenerará el target de realidad aumentada automáticamente. La postal estará
                en estado &quot;Procesando&quot; hasta que termine.
              </p>
            </div>
          )}

          {progress && (
            <div
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-xs',
                progressKind === 'error' && 'bg-destructive/10 text-destructive border border-destructive/20',
                progressKind === 'success' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
                progressKind === 'info' && 'bg-primary/10 text-primary border border-primary/20'
              )}
            >
              {uploading && <Loader2 className="size-3.5 animate-spin shrink-0" />}
              {progressKind === 'success' && <CheckCircle2 className="size-3.5 shrink-0" />}
              {progressKind === 'error' && <AlertCircle className="size-3.5 shrink-0" />}
              <span>{progress}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <UploadCloud className="size-4" />
                Guardar cambio
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
