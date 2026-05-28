'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { toast } from './use-toast';
import { useClientNFTGenerator, uploadNFTDescriptors } from './useClientNFTGenerator';

interface AutoNFTGenerationOptions {
  postcardId: string | null;
  imageUploaded: boolean;
  imageFile?: File | null; // Need the image file for client-side generation
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
 * Hook que maneja la generación automática de descriptores NFT
 * Usa el NFT Marker Creator WASM en el navegador para generar descriptores reales
 */
export function useAutoNFTGeneration({
  postcardId,
  imageUploaded,
  imageFile,
  onGenerationStart,
  onGenerationComplete,
  onGenerationError
}: AutoNFTGenerationOptions) {
  const { generateDescriptors, progress: nftProgress } = useClientNFTGenerator();
  const generationTriggeredRef = useRef(false);
  const currentPostcardIdRef = useRef<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    state: 'idle',
    attempt: 0,
    maxAttempts: 3,
    progress: 0
  });

  // Update progress from WASM generator
  useEffect(() => {
    setGenerationStatus(prev => ({ ...prev, progress: nftProgress }));
  }, [nftProgress]);

  // Reset cuando cambia el postcardId
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

  const triggerNFTGeneration = useCallback(async (isRetry: boolean = false) => {
    if (!postcardId || (generationTriggeredRef.current && !isRetry)) {
      return;
    }

    // Require image file for client-side generation
    if (!imageUploaded || !imageFile) {
      logger.warn('⚠️ [AUTO-NFT] Cannot generate: imageUploaded or imageFile missing', {
        operation: 'auto_nft_missing_requirements',
        metadata: { postcardId, imageUploaded, hasImageFile: !!imageFile }
      });
      return;
    }

    const currentAttempt = isRetry ? generationStatus.attempt + 1 : 1;
    
    if (currentAttempt > generationStatus.maxAttempts) {
      logger.error('❌ [AUTO-NFT] Máximo número de intentos alcanzado', {
        operation: 'auto_nft_max_attempts_reached',
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
      
      logger.info(`🚀 [AUTO-NFT] ${isRetry ? 'Reintentando' : 'Iniciando'} generación de NFT con WASM`, {
        operation: isRetry ? 'auto_nft_generation_retry' : 'auto_nft_generation_start',
        metadata: { postcardId, attempt: currentAttempt, imageFileName: imageFile.name }
      });

      if (!isRetry) {
        onGenerationStart?.();
      }

      // Generate descriptors using client-side WASM
      logger.info('🔧 [AUTO-NFT] Generating descriptors with NFT Marker Creator WASM...', {
        operation: 'auto_nft_wasm_start'
      });
      
      const descriptors = await generateDescriptors(imageFile);
      
      logger.info('✅ [AUTO-NFT] WASM descriptors generated, uploading to server...', {
        operation: 'auto_nft_wasm_complete',
        metadata: {
          isetSize: descriptors.isetBlob.size,
          fsetSize: descriptors.fsetBlob.size,
          fset3Size: descriptors.fset3Blob.size
        }
      });

      // Upload descriptors to server
      const uploadResult = await uploadNFTDescriptors(postcardId, '', descriptors);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload descriptors');
      }

      logger.info('✅ [AUTO-NFT] Generación de NFT completada exitosamente', {
        operation: 'auto_nft_generation_complete',
        metadata: { postcardId, attempt: currentAttempt }
      });

      setGenerationStatus(prev => ({ ...prev, state: 'completed', progress: 100 }));
      onGenerationComplete?.();

      toast({
        title: "¡NFT generado exitosamente!",
        description: currentAttempt > 1 
          ? `Los descriptores de realidad aumentada reales han sido creados (intento ${currentAttempt}).`
          : "Los descriptores de realidad aumentada reales han sido creados. ¡Tu postal de realidad aumentada está lista!",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      logger.error('❌ [AUTO-NFT] Error en generación de NFT', {
        operation: 'auto_nft_generation_error',
        metadata: { postcardId, error: errorMessage, attempt: currentAttempt }
      });

      setGenerationStatus(prev => ({ 
        ...prev, 
        state: 'error',
        lastError: errorMessage 
      }));

      // Intentar reintento automático si no hemos alcanzado el máximo
      if (currentAttempt < generationStatus.maxAttempts) {
        logger.info('🔄 [AUTO-NFT] Programando reintento automático', {
          operation: 'auto_nft_schedule_retry',
          metadata: { postcardId, nextAttempt: currentAttempt + 1 }
        });
        
        // Reintento con backoff exponencial (2^attempt segundos)
        const retryDelay = Math.pow(2, currentAttempt) * 1000;
        setTimeout(() => {
          triggerNFTGeneration(true);
        }, retryDelay);
        
        toast({
          title: "Reintentando generación NFT",
          description: `Error en intento ${currentAttempt}. Reintentando en ${Math.pow(2, currentAttempt)} segundos...`,
        });
      } else {
        onGenerationError?.(errorMessage);
        
        toast({
          title: "Error en generación de NFT",
          description: `No se pudieron generar los descriptores de realidad aumentada después de ${generationStatus.maxAttempts} intentos: ${errorMessage}`,
          variant: "destructive",
        });
        
        // Reset para permitir reintento manual
        generationTriggeredRef.current = false;
      }
    }
  }, [postcardId, imageUploaded, imageFile, generateDescriptors, onGenerationStart, onGenerationComplete, onGenerationError, generationStatus]);

  // Efecto que se ejecuta inmediatamente cuando la imagen está subida
  useEffect(() => {
    if (postcardId && imageUploaded && imageFile && !generationTriggeredRef.current) {
      // Generación inmediata sin delay
      triggerNFTGeneration();
    }
  }, [postcardId, imageUploaded, imageFile, triggerNFTGeneration]);

  return {
    isGenerationTriggered: generationTriggeredRef.current,
    generationStatus,
    triggerNFTGeneration: () => triggerNFTGeneration(false)
  };
}