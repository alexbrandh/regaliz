'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { toast } from './use-toast';
import { useMindARCompiler, uploadMindTarget } from './useMindARCompiler';

interface AutoMindARGenerationOptions {
  postcardId: string | null;
  imageUploaded: boolean;
  imageFile?: File | null;
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
 * Hook para generación automática de targets MindAR
 * Reemplaza useAutoNFTGeneration con mejor rendimiento y precisión
 */
export function useAutoMindARGeneration({
  postcardId,
  imageUploaded,
  imageFile,
  onGenerationStart,
  onGenerationComplete,
  onGenerationError
}: AutoMindARGenerationOptions) {
  const { compileImageTarget, progress: compileProgress, isCompiling } = useMindARCompiler();
  const generationTriggeredRef = useRef(false);
  const currentPostcardIdRef = useRef<string | null>(null);
  
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    state: 'idle',
    attempt: 0,
    maxAttempts: 3,
    progress: 0
  });

  // Update progress from MindAR compiler
  useEffect(() => {
    if (isCompiling) {
      setGenerationStatus(prev => ({ ...prev, progress: compileProgress }));
    }
  }, [compileProgress, isCompiling]);

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

    if (!imageUploaded || !imageFile) {
      logger.warn('⚠️ [MINDAR] Cannot generate: image not ready', {
        operation: 'mindar_missing_requirements',
        metadata: { postcardId, imageUploaded, hasImageFile: !!imageFile }
      });
      return;
    }

    const currentAttempt = isRetry ? generationStatus.attempt + 1 : 1;
    
    if (currentAttempt > generationStatus.maxAttempts) {
      logger.error('❌ [MINDAR] Max attempts reached', {
        operation: 'mindar_max_attempts',
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
        progress: 0
      });
      
      logger.info(`🚀 [MINDAR] ${isRetry ? 'Retrying' : 'Starting'} target compilation`, {
        operation: isRetry ? 'mindar_retry' : 'mindar_start',
        metadata: { postcardId, attempt: currentAttempt, imageFileName: imageFile.name }
      });

      if (!isRetry) {
        onGenerationStart?.();
      }

      // Compile image target using MindAR
      const mindBlob = await compileImageTarget(imageFile);
      
      logger.info('✅ [MINDAR] Target compiled, uploading...', {
        operation: 'mindar_compiled',
        metadata: { blobSize: mindBlob.size }
      });

      // Upload to Supabase
      const uploadResult = await uploadMindTarget(postcardId, mindBlob);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload target');
      }

      logger.info('✅ [MINDAR] Target uploaded successfully', {
        operation: 'mindar_complete',
        metadata: { postcardId }
      });

      setGenerationStatus(prev => ({ ...prev, state: 'completed', progress: 100 }));
      onGenerationComplete?.();

      toast({
        title: "¡Target de realidad aumentada generado!",
        description: "Tu postal de realidad aumentada está lista para usar.",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      logger.error('❌ [MINDAR] Generation error', {
        operation: 'mindar_error',
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
        
        logger.info('🔄 [MINDAR] Scheduling retry', {
          operation: 'mindar_schedule_retry',
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
  }, [postcardId, imageUploaded, imageFile, compileImageTarget, onGenerationStart, onGenerationComplete, onGenerationError, generationStatus]);

  // Auto-trigger when image is uploaded
  useEffect(() => {
    if (postcardId && imageUploaded && imageFile && !generationTriggeredRef.current) {
      triggerGeneration();
    }
  }, [postcardId, imageUploaded, imageFile, triggerGeneration]);

  return {
    isGenerationTriggered: generationTriggeredRef.current,
    generationStatus,
    triggerGeneration: () => triggerGeneration(false)
  };
}

export default useAutoMindARGeneration;
