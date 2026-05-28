'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { toast } from './use-toast';

interface ServerCompilationOptions {
  postcardId: string | null;
  imageUploaded: boolean;
  onGenerationStart?: () => void;
  onGenerationComplete?: () => void;
  onGenerationError?: (error: string) => void;
}

type GenerationState = 'idle' | 'generating' | 'completed' | 'error' | 'retrying';

interface GenerationStatus {
  state: GenerationState;
  attempt: number;
  maxAttempts: number;
  lastError?: string;
  progress: number;
}

/**
 * Hook para compilación de targets MindAR en el servidor
 * El servidor hace todo el trabajo pesado, el cliente solo espera
 */
export function useServerMindARCompilation({
  postcardId,
  imageUploaded,
  onGenerationStart,
  onGenerationComplete,
  onGenerationError
}: ServerCompilationOptions) {
  const generationTriggeredRef = useRef(false);
  const currentPostcardIdRef = useRef<string | null>(null);
  
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    state: 'idle',
    attempt: 0,
    maxAttempts: 3,
    progress: 0
  });

  // Reset when postcardId changes
  useEffect(() => {
    if (postcardId !== currentPostcardIdRef.current) {
      generationTriggeredRef.current = false;
      currentPostcardIdRef.current = postcardId;
      setGenerationStatus({
        state: 'idle',
        attempt: 0,
        maxAttempts: 3,
        progress: 0
      });
    }
  }, [postcardId]);

  const triggerGeneration = useCallback(async (isRetry: boolean = false) => {
    if (!postcardId || (generationTriggeredRef.current && !isRetry)) {
      return;
    }

    if (!imageUploaded) {
      logger.warn('⚠️ [MINDAR-SERVER] Cannot compile: image not uploaded yet', {
        operation: 'mindar_server_missing_image',
        metadata: { postcardId }
      });
      return;
    }

    const currentAttempt = isRetry ? generationStatus.attempt + 1 : 1;
    
    if (currentAttempt > generationStatus.maxAttempts) {
      logger.error('❌ [MINDAR-SERVER] Max attempts reached', {
        operation: 'mindar_server_max_attempts',
        metadata: { postcardId, attempts: currentAttempt }
      });
      
      setGenerationStatus(prev => ({ ...prev, state: 'error' }));
      onGenerationError?.('Máximo número de intentos alcanzado');
      return;
    }

    try {
      if (!isRetry) {
        generationTriggeredRef.current = true;
      }
      
      setGenerationStatus({
        state: isRetry ? 'retrying' : 'generating',
        attempt: currentAttempt,
        maxAttempts: generationStatus.maxAttempts,
        progress: 10
      });
      
      logger.info(`🚀 [MINDAR-SERVER] ${isRetry ? 'Retrying' : 'Starting'} server compilation`, {
        operation: isRetry ? 'mindar_server_retry' : 'mindar_server_start',
        metadata: { postcardId, attempt: currentAttempt }
      });

      if (!isRetry) {
        onGenerationStart?.();
      }

      setGenerationStatus(prev => ({ ...prev, progress: 30 }));

      // Call server endpoint to compile target
      const response = await fetch('/api/ar/compile-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcardId })
      });

      setGenerationStatus(prev => ({ ...prev, progress: 80 }));

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      logger.info('✅ [MINDAR-SERVER] Compilation complete', {
        operation: 'mindar_server_complete',
        metadata: { postcardId, fileSize: result.fileSize }
      });

      setGenerationStatus(prev => ({ ...prev, state: 'completed', progress: 100 }));
      onGenerationComplete?.();

      toast({
        title: "¡Target de realidad aumentada generado!",
        description: "Tu postal de realidad aumentada está lista para usar.",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      logger.error('❌ [MINDAR-SERVER] Compilation error', {
        operation: 'mindar_server_error',
        metadata: { postcardId, error: errorMessage, attempt: currentAttempt }
      });

      setGenerationStatus(prev => ({ 
        ...prev, 
        state: 'error',
        lastError: errorMessage 
      }));

      // Auto-retry with exponential backoff
      if (currentAttempt < generationStatus.maxAttempts) {
        const retryDelay = Math.pow(2, currentAttempt) * 1000;
        
        logger.info('🔄 [MINDAR-SERVER] Scheduling retry', {
          operation: 'mindar_server_schedule_retry',
          metadata: { postcardId, nextAttempt: currentAttempt + 1, delayMs: retryDelay }
        });
        
        setTimeout(() => {
          triggerGeneration(true);
        }, retryDelay);
        
        toast({
          title: "Reintentando...",
          description: `Error en intento ${currentAttempt}. Reintentando...`,
        });
      } else {
        onGenerationError?.(errorMessage);
        
        toast({
          title: "Error generando target de realidad aumentada",
          description: errorMessage,
          variant: "destructive",
        });
        
        generationTriggeredRef.current = false;
      }
    }
  }, [postcardId, imageUploaded, onGenerationStart, onGenerationComplete, onGenerationError, generationStatus]);

  // Auto-trigger when image is uploaded
  useEffect(() => {
    if (postcardId && imageUploaded && !generationTriggeredRef.current) {
      // Small delay to ensure image is fully uploaded
      const timer = setTimeout(() => {
        triggerGeneration();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [postcardId, imageUploaded, triggerGeneration]);

  return {
    isGenerationTriggered: generationTriggeredRef.current,
    generationStatus,
    triggerGeneration: () => triggerGeneration(false)
  };
}

export default useServerMindARCompilation;
