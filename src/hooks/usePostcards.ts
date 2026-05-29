'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import type { Postcard } from '@/types/database';
import { useNetworkStatus, isNetworkError } from './useNetworkStatus';
import {
  startRequestMonitoring,
  endRequestMonitoring,
  logNetworkError
} from '../lib/debug-utils';
import { logger } from '@/lib/logger';
import { AbortControllerManager, isAbortError } from '@/lib/abort-controller-manager';

interface CreatePostcardData {
  title: string;
  description: string;
  imageFile: File;
  videoFile: File;
}

interface CreatePostcardResponse {
  postcard: Postcard;
  imageUploadUrl: string;
  videoUploadUrl: string;
}

// Typed shape for API error responses to avoid using `any`
type ApiErrorItem = { field?: string; message?: string };
type ApiErrorResponse = {
  errors?: ApiErrorItem[];
  error?: { message?: string } | string;
  message?: string;
};

interface UsePostcardsOptions {
  /**
   * Pre-fetched postcards from the server (e.g. RSC). When provided, the hook
   * hydrates state with this data on mount and SKIPS the initial /api/postcards
   * fetch — saving a full client roundtrip on first paint. Background refresh
   * (visibilitychange, refreshAllPostcards, mutations) still works as before.
   */
  initialData?: Postcard[];
}

export function usePostcards(options: UsePostcardsOptions = {}) {
  const { initialData } = options;
  const { user, isLoaded } = useUser();
  const { retryWithConnection, isOnline } = useNetworkStatus();
  const [postcards, _setPostcards] = useState<Postcard[]>(() => initialData ?? []);
  // If we already have server-rendered data, we're not "loading" on first paint.
  const [loading, setLoading] = useState<boolean>(initialData === undefined);
  const [error, setError] = useState<string | null>(null);
  // Track whether the initial fetch has already run (server-prefetch counts as run).
  const hasHydratedRef = useRef<boolean>(initialData !== undefined);

  // Safe wrapper that ALWAYS deduplicates before setting state
  const setPostcards = useCallback((value: Postcard[] | ((prev: Postcard[]) => Postcard[])) => {
    _setPostcards(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      const deduplicated = deduplicatePostcards(newValue);
      // Dedupe logging removed for performance
      return deduplicated;
    });
  }, []);
  const isRequestInProgressRef = useRef<boolean>(false);
  const abortManagerRef = useRef<AbortControllerManager>(new AbortControllerManager('usePostcards'));

  // Helper function to ensure state is always an array
  const ensureArray = (value: unknown): Postcard[] => {
    if (Array.isArray(value)) {
      return value;
    }
    console.warn('Postcards state is not an array, resetting to empty array:', value);
    return [];
  };

  // Helper function to deduplicate postcards by ID
  const deduplicatePostcards = (postcards: Postcard[]): Postcard[] => {
    const seen = new Set();
    return postcards.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  };

  // Enhanced fetch function with retry logic and network awareness
  const fetchPostcardsImmediate = useCallback(async (forceCacheBust = false) => {
    logger.info('🔄 [FETCH] Starting fetch postcards', {
      operation: 'fetch_postcards_start',
      metadata: { forceCacheBust, isOnline }
    });

    // Wait for Clerk to load
    if (!isLoaded) {
      logger.info('⏳ [FETCH] Clerk not loaded yet, waiting...');
      return;
    }

    if (!user) {
      logger.info('❌ [FETCH] No user found, skipping fetch');
      setPostcards([]);
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous requests
    if (isRequestInProgressRef.current) {
      logger.info('⏸️ [FETCH] Request already in progress, skipping');
      return;
    }

    const requestId = `fetch-${Date.now()}`;

    try {
      setLoading(true);
      setError(null);
      isRequestInProgressRef.current = true;

      // Use retry mechanism with network awareness
      const result = await retryWithConnection(async () => {
        const managedController = abortManagerRef.current.create(requestId, {
          timeout: 30000, // 30s — batch signed URLs are fast but allow headroom
          debugLabel: `fetchPostcards`,
          onTimeout: () => logger.warn('⏰ [FETCH] Request timeout', {
            operation: 'fetch_timeout',
            metadata: { requestId }
          })
        });

        try {
          logger.info('📡 [FETCH] Making API request...', {
            operation: 'fetch_api_request',
            metadata: { requestId }
          });

          const url = forceCacheBust ? `/api/postcards?t=${Date.now()}` : '/api/postcards';

          // No Content-Type on GET — it forces a CORS preflight on cross-origin
          // and is meaningless without a body. No client Cache-Control either:
          // request headers don't control response caching; the server sets
          // Cache-Control on the response.
          const response = await fetch(url, {
            method: 'GET',
            cache: forceCacheBust ? 'no-store' : 'default',
            signal: managedController.controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          logger.info('✅ [FETCH] Success', {
            operation: 'fetch_success',
            metadata: { count: data.postcards?.length || 0 }
          });

          return data;
        } catch (error: unknown) {
          // Check if it's an abort error and handle appropriately
          if (isAbortError(error)) {
            logger.info('🚫 [FETCH] Request aborted', {
              operation: 'fetch_error',
              metadata: { requestId, isTimeout: managedController.isTimedOut() }
            });
            throw error;
          }

          logNetworkError(error, {
            url: '/api/postcards',
            method: 'GET',
            retryCount: 0
          });
          throw error;
        } finally {
          abortManagerRef.current.abort(requestId);
        }
      }, 3); // Max 3 retries

      // Ensure we extract the postcards array from the response
      // The API returns { success: true, data: { postcards: [...] } }
      const postcardsArray = ensureArray(result.data?.postcards || []);
      setPostcards(postcardsArray);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      logger.error('❌ [FETCH] Failed after retries', {
        operation: 'fetch_failed',
        metadata: { error: errorMessage, isNetworkError: isNetworkError(err) }
      });

      setError(errorMessage);

      // Show user-friendly error message
      if (isNetworkError(err)) {
        toast.error('Connection problem. Please check your internet and try again.');
      } else {
        toast.error('Failed to load postcards. Please try again.');
      }
    } finally {
      setLoading(false);
      isRequestInProgressRef.current = false;
    }
  }, [isLoaded, user, retryWithConnection, isOnline]);

  // Simplified public fetch function
  const fetchPostcards = useCallback((forceCacheBust = false) => {
    return fetchPostcardsImmediate(forceCacheBust);
  }, [fetchPostcardsImmediate]);

  // Initial fetch when Clerk finishes loading — skipped when initialData was
  // already provided by a Server Component pre-fetch.
  useEffect(() => {
    if (!isLoaded) return;
    if (hasHydratedRef.current) {
      hasHydratedRef.current = false; // allow visibilitychange/refresh to fetch later
      return;
    }
    fetchPostcards(false);
  }, [isLoaded, fetchPostcards]);

  // Cleanup effect - cancel all pending requests
  useEffect(() => {
    const abortManager = abortManagerRef.current;
    return () => {
      logger.info('🧹 [POSTCARDS] Cleaning up pending requests');
      abortManager.abortAll();

      // Reset flags
      isRequestInProgressRef.current = false;
    };
  }, []);

  // Create a new postcard with network-aware retry logic
  const createPostcard = useCallback(async (data: CreatePostcardData): Promise<CreatePostcardResponse> => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const requestId = startRequestMonitoring('/api/postcards', 'POST');

    logger.info('🚀 [CREATE] Starting postcard creation', {
      operation: 'create_start',
      metadata: {
        title: data.title,
        description: data.description,
        imageFileName: data.imageFile.name,
        videoFileName: data.videoFile.name,
        imageSize: data.imageFile.size,
        videoSize: data.videoFile.size,
        isOnline,
        currentPostcardsCount: postcards.length,
        requestId
      }
    });

    if (!isOnline) {
      const error = new Error('No internet connection. Please check your connection and try again.');
      logNetworkError(error, { url: '/api/postcards', method: 'POST' });
      endRequestMonitoring(requestId, 'error', undefined, 'network');
      toast.error('No internet connection. Please check your connection and try again.');
      throw error;
    }

    const createRequestId = `create-${Date.now()}`;

    try {
      const result = await retryWithConnection(async () => {
        const managedController = abortManagerRef.current.create(createRequestId, {
          timeout: 45000, // Reduced from 60s to 45s for better UX
          debugLabel: `createPostcard`,
          onTimeout: () => logger.warn('⏰ [CREATE] Request timeout', {
            operation: 'create_timeout',
            metadata: { requestId }
          })
        });

        try {
          logger.info('📡 [CREATE] Making API request...', {
            operation: 'create_api_request',
            metadata: { requestId }
          });

          const response = await fetch('/api/postcards', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            body: JSON.stringify({
              title: data.title,
              description: data.description,
              imageSize: data.imageFile.size,
              videoSize: data.videoFile.size,
              imageFileName: data.imageFile.name,
              videoFileName: data.videoFile.name,
            }),
            signal: managedController.controller.signal,
          });

          logger.info('📡 [CREATE] Response received', {
            operation: 'create_response_received',
            metadata: { status: response.status, requestId }
          });

          if (!response.ok) {
            const rawError: unknown = await response.json().catch(() => ({} as unknown));
            const errorData: ApiErrorResponse = (rawError && typeof rawError === 'object')
              ? (rawError as ApiErrorResponse)
              : {} as ApiErrorResponse;
            logger.error('❌ [CREATE] API Error', {
              operation: 'create_api_error',
              metadata: { status: response.status, error: errorData, requestId }
            });
            // Prefer backend validation errors when present
            const validationMessages = Array.isArray(errorData?.errors)
              ? (errorData.errors as ApiErrorItem[])
                .map(e => e?.message)
                .filter(Boolean)
              : [];
            const errorFieldMessage = typeof errorData?.error === 'string'
              ? errorData.error
              : (errorData?.error && typeof errorData.error === 'object' && 'message' in errorData.error
                ? (errorData.error as { message?: string }).message
                : undefined);
            const message =
              (validationMessages.length > 0
                ? `Validation error: ${validationMessages.join('; ')}`
                : (errorFieldMessage || errorData.message)) ||
              `HTTP error! status: ${response.status}`;
            throw new Error(message);
          }

          const resJson = await response.json();
          const dataPayload = resJson?.data;
          logger.info('✅ [CREATE] Success', {
            operation: 'create_success',
            metadata: {
              postcardId: dataPayload?.postcard?.id,
              title: dataPayload?.postcard?.title,
              requestId
            }
          });
          return dataPayload as CreatePostcardResponse;
        } catch (error: unknown) {
          // Check if it's an abort error and handle appropriately
          if (isAbortError(error)) {
            logger.info('🚫 [CREATE] Request aborted', {
              operation: 'create_aborted',
              metadata: { requestId, isTimeout: managedController.isTimedOut() }
            });
            throw error;
          }

          logNetworkError(error, {
            url: '/api/postcards',
            method: 'POST',
            retryCount: 0
          });
          throw error;
        } finally {
          abortManagerRef.current.abort(createRequestId);
        }
      }, 2); // Max 2 retries for creation

      // Immediately add to local state
      logger.info('📝 [CREATE] Adding postcard to local state');
      setPostcards(prev => {
        const safeArray = ensureArray(prev);
        const newState = [result.postcard, ...safeArray];
        logger.info('📊 [CREATE] New state length', {
          operation: 'create_state_updated',
          metadata: { length: newState.length }
        });
        return newState;
      });

      endRequestMonitoring(requestId, 'success');
      toast.success('Postcard created successfully!');
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create postcard';
      logger.error('❌ [CREATE] Creation failed after retries', {
        operation: 'create_failed',
        metadata: { error: errorMessage, isNetworkError: isNetworkError(err), requestId }
      });

      endRequestMonitoring(requestId, 'error', undefined, err instanceof Error ? err.name : 'unknown');

      if (isNetworkError(err)) {
        toast.error('Connection problem during creation. Please check your internet and try again.');
      } else {
        toast.error(errorMessage);
      }
      throw err;
    }
  }, [user, postcards.length, retryWithConnection, isOnline]);

  // Delete a postcard
  const deletePostcard = useCallback(async (postcardId: string): Promise<boolean> => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    logger.info('🗑️ [DELETE] Starting deletion', {
      operation: 'delete_start',
      metadata: { id: postcardId, isOnline }
    });

    if (!isOnline) {
      toast.error('No internet connection. Please check your connection and try again.');
      return false;
    }

    const requestId = `delete-${postcardId}-${Date.now()}`;

    try {
      await retryWithConnection(async () => {
        const managedController = abortManagerRef.current.create(requestId, {
          timeout: 20000, // Reduced from 30s to 20s for faster feedback
          debugLabel: `deletePostcard-${postcardId}`,
          onTimeout: () => logger.warn('⏰ [DELETE] Request timeout', {
            operation: 'delete_timeout',
            metadata: { postcardId }
          })
        });

        try {
          logger.info('📡 [DELETE] Making API request...', {
            operation: 'delete_api_request',
            metadata: { postcardId }
          });
          const response = await fetch(`/api/postcards/${postcardId}`, {
            method: 'DELETE',
            signal: managedController.controller.signal,
          });

          if (!response.ok) {
            const rawError: unknown = await response.json().catch(() => ({} as unknown));
            const errorData: ApiErrorResponse = (rawError && typeof rawError === 'object')
              ? (rawError as ApiErrorResponse)
              : {} as ApiErrorResponse;
            logger.error('❌ [DELETE] API Error', {
              operation: 'delete_api_error',
              metadata: { status: response.status, error: errorData }
            });
            const errorFieldMessage = typeof errorData?.error === 'string'
              ? errorData.error
              : (errorData?.error && typeof errorData.error === 'object' && 'message' in errorData.error
                ? (errorData.error as { message?: string }).message
                : undefined);
            const message =
              (errorFieldMessage || errorData.message) ||
              `HTTP error! status: ${response.status}`;
            throw new Error(message);
          }

          logger.info('✅ [DELETE] Success', {
            operation: 'delete_success',
            metadata: { id: postcardId }
          });
          return true;
        } catch (error: unknown) {
          if (isAbortError(error)) {
            logger.info('🚫 [DELETE] Request aborted', {
              operation: 'delete_aborted',
              metadata: { postcardId, isTimeout: managedController.isTimedOut() }
            });
            throw error;
          }
          throw error;
        } finally {
          abortManagerRef.current.abort(requestId);
        }
      }, 3); // Max 3 retries

      // Remove from local state
      setPostcards(prev => {
        const updated = ensureArray(prev).filter(p => p.id !== postcardId);
        logger.info('📝 [DELETE] Updated local state', {
          operation: 'delete_state_updated',
          metadata: { count: updated.length }
        });
        return updated;
      });

      toast.success('Postcard deleted successfully!');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete postcard';
      logger.error('❌ [DELETE] Failed after retries', {
        operation: 'delete_failed',
        metadata: { error: errorMessage, isNetworkError: isNetworkError(error) }
      });

      if (isNetworkError(error)) {
        toast.error('Connection problem during deletion. Please check your internet and try again.');
      } else {
        toast.error(errorMessage);
      }
      return false;
    }
  }, [user, retryWithConnection, isOnline]);

  // Generate NFT for a postcard
  const generateNFT = useCallback(async (postcardId: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const requestId = startRequestMonitoring('/api/nft/generate', 'POST');

    logger.info('🎨 [NFT] Starting NFT generation', {
      operation: 'nft_generation_start',
      metadata: { postcardId, isOnline, requestId }
    });

    if (!isOnline) {
      const error = new Error('No internet connection. Please check your connection and try again.');
      logNetworkError(error, { url: '/api/nft/generate', method: 'POST' });
      endRequestMonitoring(requestId, 'error', undefined, 'network');
      toast.error('No internet connection. Please check your connection and try again.');
      throw error;
    }

    const nftRequestId = `nft-${postcardId}-${Date.now()}`;

    try {
      // Update local state to show processing with defensive programming
      setPostcards(prev => {
        const safeArray = ensureArray(prev);
        return safeArray.map(p =>
          p.id === postcardId
            ? { ...p, processing_status: 'processing' as const }
            : p
        );
      });

      // 1) Kick off generation (retry only this step)
      await retryWithConnection(async () => {
        const managedController = abortManagerRef.current.create(nftRequestId, {
          timeout: 120000, // 2 minutes for NFT generation
          debugLabel: `generateNFT-${postcardId}`,
          onTimeout: () => logger.warn('⏰ [NFT] Request timeout', {
            operation: 'nft_timeout',
            metadata: { requestId, postcardId }
          })
        });

        try {
          logger.info('📡 [NFT] Making API request...', {
            operation: 'nft_api_request',
            metadata: { postcardId, requestId }
          });

          const response = await fetch('/api/nft/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postcardId }),
            signal: managedController.controller.signal,
          });

          if (!response.ok) {
            // Try to parse structured error
            const rawError: unknown = await response.json().catch(() => ({} as unknown));
            const errorData: ApiErrorResponse = (rawError && typeof rawError === 'object')
              ? (rawError as ApiErrorResponse)
              : {} as ApiErrorResponse;
            const errorObj = (errorData && typeof errorData.error === 'object')
              ? (errorData.error as Record<string, unknown>)
              : undefined;
            const errorCode = (errorObj?.code as string | undefined) || undefined;
            const isAlreadyProcessing = response.status === 409 || errorCode === 'ALREADY_PROCESSING';

            if (isAlreadyProcessing) {
              logger.info('ℹ️ [NFT] Already processing; proceeding to polling', {
                operation: 'nft_already_processing',
                metadata: { postcardId, status: response.status, errorCode }
              });
              return; // treat as success for kickoff
            }

            logger.error('❌ [NFT] API Error', {
              operation: 'nft_api_error',
              metadata: { status: response.status, error: errorData, postcardId }
            });
            const errorFieldMessage = typeof errorData?.error === 'string'
              ? errorData.error
              : (errorData?.error && typeof errorData.error === 'object' && 'message' in errorData.error
                ? (errorData.error as { message?: string }).message
                : undefined);
            const message = (errorFieldMessage || errorData.message) || `HTTP error! status: ${response.status}`;
            throw new Error(message);
          }
        } catch (error: unknown) {
          if (isAbortError(error)) {
            logger.info('🚫 [NFT] Request aborted', {
              operation: 'nft_aborted',
              metadata: { requestId, postcardId, isTimeout: managedController.isTimedOut() }
            });
            throw error;
          }
          logNetworkError(error, {
            url: '/api/nft/generate',
            method: 'POST',
            retryCount: 0
          });
          throw error;
        } finally {
          abortManagerRef.current.abort(nftRequestId);
        }
      }, 2); // Max 2 retries for kickoff only

      // 2) Poll status (do NOT include in retry wrapper to avoid multi-minute loops)
      logger.info('✅ [NFT] Kickoff accepted; starting polling', {
        operation: 'nft_generation_requested',
        metadata: { postcardId }
      });

      const maxAttempts = 30; // ~90s with 3s interval (reduced from 60)
      let completed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const statusRes = await fetch(`/api/nft/generate?postcardId=${encodeURIComponent(postcardId)}`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
          });

          if (statusRes.ok) {
            const statusJson = await statusRes.json();
            const status = statusJson?.status as Postcard['processing_status'] | undefined;

            if (status === 'ready' && statusJson?.ready) {
              setPostcards(prev => {
                const safeArray = ensureArray(prev);
                return safeArray.map(p =>
                  p.id === postcardId
                    ? { ...p, processing_status: 'ready' as const }
                    : p
                );
              });
              await fetchPostcards(true);
              toast.success('NFT is ready.');
              completed = true;
              break;
            }

            if (status === 'error' || status === 'needs_better_image') {
              setPostcards(prev => {
                const safeArray = ensureArray(prev);
                return safeArray.map(p =>
                  p.id === postcardId
                    ? { ...p, processing_status: status, error_message: statusJson?.errorMessage || p.error_message }
                    : p
                );
              });
              if (status === 'error') toast.error(statusJson?.errorMessage || 'Falló la generación NFT.');
              if (status === 'needs_better_image') toast.info('La imagen necesita mejorar para el seguimiento de realidad aumentada.');
              completed = true;
              break;
            }
          }
        } catch (err) {
          logger.warn?.('⚠️ [NFT] Polling error (will retry)', {
            operation: 'nft_poll_error',
            metadata: { postcardId, error: err instanceof Error ? err.message : String(err) }
          });
        }
        await new Promise(res => setTimeout(res, 3000)); // Increased from 2s to 3s to reduce load
      }

      if (!completed) {
        logger.warn('⌛ [NFT] Polling timed out', { operation: 'nft_poll_timeout', metadata: { postcardId } });
        throw new Error('NFT generation timed out. Please try again or check connection.');
      }

      endRequestMonitoring(requestId, 'success');
      toast.success('NFT generation started. We will update the status shortly.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate NFT';
      logger.error('❌ [NFT] Failed after retries', {
        operation: 'nft_failed',
        metadata: { error: errorMessage, isNetworkError: isNetworkError(err), requestId }
      });

      endRequestMonitoring(requestId, 'error', undefined, err instanceof Error ? err.name : 'unknown');

      // Update local state to show error with defensive programming
      setPostcards(prev => {
        const safeArray = ensureArray(prev);
        return safeArray.map(p =>
          p.id === postcardId
            ? { ...p, processing_status: 'error' as const, error_message: errorMessage }
            : p
        );
      });

      if (isNetworkError(err)) {
        toast.error('Connection problem during NFT generation. Please check your internet and try again.');
      } else {
        toast.error(errorMessage);
      }
      throw err;
    }
  }, [user, retryWithConnection, isOnline, fetchPostcards]);

  // Get AR link for a postcard
  const getARLink = useCallback((postcardId: string): string => {
    return `${window.location.origin}/ar/${postcardId}`;
  }, []);

  // Copy AR link to clipboard
  const copyARLink = useCallback(async (postcardId: string): Promise<void> => {
    try {
      const link = getARLink(postcardId);
      await navigator.clipboard.writeText(link);
      toast.success('¡Enlace de realidad aumentada copiado al portapapeles!');
    } catch {
      toast.error('No se pudo copiar el enlace de realidad aumentada');
    }
  }, [getARLink]);

  // Generate QR code for AR link
  const generateQRCode = useCallback((postcardId: string): string => {
    const link = getARLink(postcardId);
    // Using QR Server API for QR code generation
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
  }, [getARLink]);

  // Refresh postcards list (no specific ID needed)
  const refreshPostcard = useCallback(async (): Promise<void> => {
    try {
      // Use the list endpoint to keep a consistent shape with local state
      await fetchPostcards(true);
    } catch (err) {
      // Silently fail for refresh operations
      console.error('Failed to refresh postcard:', err);
    }
  }, [fetchPostcards]);

  // REMOVED: Duplicate useEffect that caused double fetch
  // The fetch is already handled by the useEffect at line ~200 when isLoaded changes

  // Refresh all postcards with cache busting
  const refreshAllPostcards = useCallback(async (): Promise<void> => {
    await fetchPostcards(true); // Force cache bust
  }, [fetchPostcards]);

  return {
    postcards,
    loading,
    error,
    fetchPostcards,
    createPostcard,
    deletePostcard,
    generateNFT,
    getARLink,
    copyARLink,
    generateQRCode,
    refreshPostcard,
    refreshAllPostcards,
  };
}