'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  AbortControllerManager
} from '@/lib/abort-controller-manager';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  startRequestMonitoring,
  endRequestMonitoring,
  logNetworkError
} from '@/lib/debug-utils';
import { isNetworkError } from '@/hooks/useNetworkStatus';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'aborted';
  error?: string;
}

interface UseUploadOptions {
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
  onSuccess?: (file: File, url: string) => void;
  onError?: (file: File, error: string) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const ENV_MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '50');
  const DEFAULT_MAX_FILE_SIZE = (Number.isFinite(ENV_MAX_FILE_SIZE_MB) ? ENV_MAX_FILE_SIZE_MB : 50) * 1024 * 1024;
  const ENV_UPLOAD_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPLOAD_TIMEOUT_MS || '120000');
  const BASE_UPLOAD_TIMEOUT_MS = Number.isFinite(ENV_UPLOAD_TIMEOUT_MS) && ENV_UPLOAD_TIMEOUT_MS > 0 ? ENV_UPLOAD_TIMEOUT_MS : 120000;

  // Dynamic timeout: base 120s + extra time for large files (assumes worst-case 1 Mbps upload)
  const calculateTimeout = useCallback((fileSize: number): number => {
    const extraMs = (fileSize / (1024 * 1024)) * 8 * 1000; // 8s per MB at 1 Mbps
    return Math.max(BASE_UPLOAD_TIMEOUT_MS, BASE_UPLOAD_TIMEOUT_MS + extraMs);
  }, [BASE_UPLOAD_TIMEOUT_MS]);

  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE, // from env (fallback 50MB)
    allowedTypes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
    onSuccess,
    onError,
  } = options;

  const { retryWithConnection, isOnline } = useNetworkStatus();
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  // Enhanced abort controller manager
  const abortManagerRef = useRef<AbortControllerManager>(new AbortControllerManager('useUpload'));

  const validateFile = useCallback(async (file: File): Promise<string | null> => {
    if (file.size > maxFileSize) {
      return `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`;
    }

    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }

    // Additional validation for images
    if (file.type.startsWith('image/')) {
      return new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 800 || img.height < 800) {
            resolve('La resolución de la imagen debe ser al menos 800x800 píxeles para una experiencia óptima de realidad aumentada');
          } else {
            resolve(null);
          }
        };
        img.onerror = () => resolve('Invalid image file');
        img.src = URL.createObjectURL(file);
      });
    }

    return null;
  }, [maxFileSize, allowedTypes]);

  const uploadFile = useCallback(async (file: File, uploadUrl: string, opts?: { uploadId?: string; timeoutMs?: number; skipValidation?: boolean }): Promise<string> => {
    const fileId = opts?.uploadId ?? `${file.name}-${Date.now()}`;
    const requestId = startRequestMonitoring(uploadUrl, 'PUT');

    logger.info('🚀 [UPLOAD] Starting file upload', {
      operation: 'upload_start',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isOnline,
        requestId
      }
    });

    // Check network connectivity
    if (!isOnline) {
      const errorMsg = 'No hay conexión a internet. Por favor, verifica tu conexión.';
      logger.error('❌ [UPLOAD] No network connection', {
        operation: 'upload_no_network',
        metadata: { fileName: file.name, requestId }
      });
      logNetworkError(new Error(errorMsg), { url: uploadUrl, method: 'PUT' });
      endRequestMonitoring(requestId, 'error', undefined, 'network');
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate file (skip if caller already validated, e.g. cropped images)
    if (!opts?.skipValidation) {
      const validationError = await validateFile(file);
      if (validationError) {
        logger.error('❌ [UPLOAD] File validation failed', {
          operation: 'upload_validation_failed',
          metadata: { fileName: file.name, error: validationError, requestId }
        });
        endRequestMonitoring(requestId, 'error', undefined, 'validation');
        throw new Error(validationError);
      }
    }

    // Initialize upload progress
    setUploads(prev => new Map(prev.set(fileId, {
      file,
      progress: 0,
      status: 'uploading'
    })));

    // Create managed controller for this upload
    const managedController = abortManagerRef.current.create(fileId, {
      timeout: opts?.timeoutMs ?? calculateTimeout(file.size),
      debugLabel: `upload-${fileId}`
    });

    try {
      await retryWithConnection(async () => {
        logger.info('📤 [UPLOAD] Starting upload', {
          operation: 'upload_attempt',
          metadata: { fileName: file.name, requestId }
        });

        // Check if upload was cancelled
        if (managedController.controller.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        // Upload file with progress tracking
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
          signal: managedController.controller.signal
        });

        logger.info('📡 [UPLOAD] Response received', {
          operation: 'upload_response_received',
          metadata: {
            fileName: file.name,
            status: response.status,
            statusText: response.statusText,
            requestId
          }
        });

        if (!response.ok) {
          const responseText = await response.text().catch(() => 'Unable to read response');
          logger.error('❌ [UPLOAD] Upload failed', {
            operation: 'upload_failed',
            metadata: {
              fileName: file.name,
              status: response.status,
              statusText: response.statusText,
              response: responseText,
              requestId
            }
          });
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        logger.info('✅ [UPLOAD] File uploaded successfully', {
          operation: 'upload_success',
          metadata: { fileName: file.name, requestId }
        });
        return response;
      });

      // Update progress to completed
      setUploads(prev => new Map(prev.set(fileId, {
        file,
        progress: 100,
        status: 'completed'
      })));

      const finalUrl = uploadUrl.split('?')[0]; // Remove query parameters
      endRequestMonitoring(requestId, 'success', 200);
      onSuccess?.(file, finalUrl);
      toast.success(`${file.name} subido exitosamente`);

      return finalUrl;

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed');

      // Log the error for monitoring
      const errorId = logNetworkError(err, {
        url: uploadUrl,
        method: 'PUT'
      });

      // Handle specific error types
      let userMessage = 'Error al subir el archivo';
      let errorType = 'unknown';

      if (err.name === 'AbortError' || err.message.includes('ERR_ABORTED')) {
        if (err.message.includes('cancelled')) {
          userMessage = 'Subida cancelada';
          errorType = 'cancelled';
        } else {
          userMessage = 'La subida fue interrumpida. Reintentando...';
          errorType = 'aborted';
        }
      } else if (isNetworkError(err)) {
        userMessage = 'Error de conexión. Verifica tu internet.';
        errorType = 'network';
      } else if (err.message.includes('timeout')) {
        userMessage = 'La subida tardó demasiado. Intenta con un archivo más pequeño.';
        errorType = 'timeout';
      }

      logger.error('❌ [UPLOAD] Upload failed completely', {
        operation: 'upload_file',
        metadata: {
          fileName: file.name,
          error: err.message,
          errorName: err.name,
          stack: err.stack,
          requestId,
          errorId
        }
      });

      endRequestMonitoring(requestId, 'error', undefined, errorType);

      setUploads(prev => new Map(prev.set(fileId, {
        file,
        progress: 0,
        status: 'error',
        error: err.message
      })));

      onError?.(file, err.message);
      toast.error(`${file.name}: ${userMessage}`);
      throw err;

    } finally {
      // Cleanup managed by AbortControllerManager
      abortManagerRef.current.abort(fileId);
    }
  }, [validateFile, onSuccess, onError, retryWithConnection, isOnline, calculateTimeout]);

  const removeUpload = useCallback((fileId: string) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  }, []);

  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);

  const cancelUpload = useCallback((uploadFileId: string) => {
    abortManagerRef.current.abort(uploadFileId);

    // Update upload state
    setUploads(prev => {
      const newUploads = new Map(prev);
      const upload = newUploads.get(uploadFileId);
      if (upload) {
        newUploads.set(uploadFileId, {
          ...upload,
          status: 'error',
          error: 'Upload cancelled by user'
        });
      }
      return newUploads;
    });

    logger.info('🚫 [UPLOAD] Upload cancelled by user', {
      operation: 'upload_cancelled',
      metadata: { uploadFileId }
    });
  }, []);

  const cancelAllUploads = useCallback(() => {
    logger.info('🚫 [UPLOAD] Cancelling all uploads');
    abortManagerRef.current.abortAll();

    // Update all upload states
    setUploads(prev => {
      const newUploads = new Map();
      prev.forEach((upload, id) => {
        if (upload.status === 'uploading') {
          newUploads.set(id, {
            ...upload,
            status: 'aborted',
            error: 'Upload cancelled by user'
          });
        } else {
          newUploads.set(id, upload);
        }
      });
      return newUploads;
    });
  }, []);

  const getUploadProgress = useCallback((fileName: string) => {
    const uploadsArray = Array.from(uploads.values());
    return uploadsArray.find(upload => upload.file.name === fileName) || null;
  }, [uploads]);

  // Cleanup effect - cancel all pending uploads
  useEffect(() => {
    const abortManager = abortManagerRef.current;
    return () => {
      logger.info('🧹 [UPLOAD] Cleaning up pending uploads');
      abortManager.abortAll();
    };
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    uploadFile,
    removeUpload,
    clearUploads,
    cancelUpload,
    cancelAllUploads,
    getUploadProgress,
    validateFile,
    isOnline,
  };
}