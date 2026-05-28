'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { toast } from './use-toast';

interface WorkerCompilationOptions {
  postcardId: string | null;
  imageUploaded: boolean;
  imageFile: File | null;
  onGenerationStart?: () => void;
  onGenerationComplete?: () => void;
  onGenerationError?: (error: string) => void;
}

interface CompilationStatus {
  state: 'idle' | 'loading' | 'compiling' | 'uploading' | 'completed' | 'error';
  progress: number;
  message: string;
}

/**
 * Hook para compilación de targets MindAR usando Web Worker
 * Compila en el navegador sin bloquear el UI
 */
export function useMindARWorkerCompiler({
  postcardId,
  imageUploaded,
  imageFile,
  onGenerationStart,
  onGenerationComplete,
  onGenerationError
}: WorkerCompilationOptions) {
  const workerRef = useRef<Worker | null>(null);
  const generationTriggeredRef = useRef(false);
  const currentPostcardIdRef = useRef<string | null>(null);
  
  const [status, setStatus] = useState<CompilationStatus>({
    state: 'idle',
    progress: 0,
    message: ''
  });

  // Initialize worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      workerRef.current = new Worker('/workers/mindar-compiler-worker.js');
      
      workerRef.current.onmessage = (e) => {
        const { type, progress, message, data, error } = e.data;

        switch (type) {
          case 'ready':
            logger.info('🔧 [MINDAR-WORKER] Worker ready');
            break;

          case 'progress':
            setStatus({
              state: 'compiling',
              progress: progress || 0,
              message: message || 'Compiling...'
            });
            break;

          case 'complete':
            handleCompilationComplete(data);
            break;

          case 'error':
            handleCompilationError(error);
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        logger.error('❌ [MINDAR-WORKER] Worker error', { operation: 'worker_error' }, new Error(error.message || 'Worker error'));
        handleCompilationError(error.message || 'Worker error');
      };

    } catch (e) {
      logger.error('❌ [MINDAR-WORKER] Failed to create worker', { operation: 'worker_create_error' }, e as Error);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Reset when postcardId changes
  useEffect(() => {
    if (postcardId !== currentPostcardIdRef.current) {
      generationTriggeredRef.current = false;
      currentPostcardIdRef.current = postcardId;
      setStatus({ state: 'idle', progress: 0, message: '' });
    }
  }, [postcardId]);

  const handleCompilationComplete = useCallback(async (compiledData: ArrayBuffer) => {
    if (!currentPostcardIdRef.current) return;

    setStatus({ state: 'uploading', progress: 0.95, message: 'Uploading target...' });

    try {
      // Upload compiled .mind file to server
      const formData = new FormData();
      formData.append('postcardId', currentPostcardIdRef.current);
      formData.append('mindFile', new Blob([compiledData], { type: 'application/octet-stream' }), 'target.mind');

      const response = await fetch('/api/ar/upload-mind-target', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Upload failed');
      }

      logger.info('✅ [MINDAR-WORKER] Compilation and upload complete', {
        operation: 'mindar_worker_complete',
        metadata: { postcardId: currentPostcardIdRef.current, size: compiledData.byteLength }
      });

      setStatus({ state: 'completed', progress: 1, message: 'Complete!' });
      onGenerationComplete?.();

      toast({
        title: "¡Target de realidad aumentada generado!",
        description: "Tu postal de realidad aumentada está lista.",
      });

    } catch (e) {
      handleCompilationError(e instanceof Error ? e.message : 'Upload failed');
    }
  }, [onGenerationComplete]);

  const handleCompilationError = useCallback((error: string) => {
    logger.error('❌ [MINDAR-WORKER] Compilation error', {
      operation: 'mindar_worker_error',
      metadata: { postcardId: currentPostcardIdRef.current, error }
    });

    setStatus({ state: 'error', progress: 0, message: error });
    onGenerationError?.(error);
    generationTriggeredRef.current = false;

    toast({
      title: "Error generando target de realidad aumentada",
      description: error,
      variant: "destructive",
    });
  }, [onGenerationError]);

  const triggerCompilation = useCallback(async () => {
    if (!postcardId || !imageFile || generationTriggeredRef.current) {
      return;
    }

    if (!workerRef.current) {
      handleCompilationError('Worker not initialized');
      return;
    }

    generationTriggeredRef.current = true;
    onGenerationStart?.();

    setStatus({ state: 'loading', progress: 0.05, message: 'Loading image...' });

    try {
      // Convert image file to data URL
      const dataUrl = await fileToDataUrl(imageFile);

      // Get image dimensions
      const dimensions = await getImageDimensions(dataUrl);

      logger.info('🚀 [MINDAR-WORKER] Starting compilation', {
        operation: 'mindar_worker_start',
        metadata: { postcardId, width: dimensions.width, height: dimensions.height }
      });

      // Send to worker
      workerRef.current.postMessage({
        type: 'compile',
        data: {
          imageDataUrl: dataUrl,
          width: dimensions.width,
          height: dimensions.height
        }
      });

    } catch (e) {
      handleCompilationError(e instanceof Error ? e.message : 'Failed to load image');
    }
  }, [postcardId, imageFile, onGenerationStart, handleCompilationError]);

  // Auto-trigger when image is uploaded
  useEffect(() => {
    if (postcardId && imageUploaded && imageFile && !generationTriggeredRef.current) {
      const timer = setTimeout(() => {
        triggerCompilation();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [postcardId, imageUploaded, imageFile, triggerCompilation]);

  return {
    status,
    triggerCompilation
  };
}

// Helper functions
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export default useMindARWorkerCompiler;
