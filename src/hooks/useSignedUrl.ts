import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseSignedUrlOptions {
  bucket: string;
  path: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  enabled?: boolean;
}

interface UseSignedUrlReturn {
  signedUrl: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook para generar y manejar signed URLs de Supabase Storage
 * Previene errores ORB al usar URLs firmadas en lugar de URLs públicas
 */
export function useSignedUrl({
  bucket,
  path,
  expiresIn = 3600,
  enabled = true,
}: UseSignedUrlOptions): UseSignedUrlReturn {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSignedUrl = useCallback(async () => {
    if (!enabled || !path) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: supabaseError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (supabaseError) {
        throw new Error(`Error generating signed URL: ${supabaseError.message}`);
      }

      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
      } else {
        throw new Error('No signed URL returned');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('useSignedUrl error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [bucket, path, expiresIn, enabled]);

  const refresh = useCallback(() => {
    generateSignedUrl();
  }, [generateSignedUrl]);

  useEffect(() => {
    generateSignedUrl();
  }, [generateSignedUrl]);

  // Auto-refresh before expiration (refresh at 90% of expiration time)
  useEffect(() => {
    if (!signedUrl || !enabled) return;

    const refreshTime = (expiresIn * 1000) * 0.9; // 90% of expiration time
    const timeoutId = setTimeout(() => {
      generateSignedUrl();
    }, refreshTime);

    return () => clearTimeout(timeoutId);
  }, [signedUrl, expiresIn, enabled, generateSignedUrl]);

  return {
    signedUrl,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook para manejar múltiples signed URLs
 */
export function useMultipleSignedUrls(
  urls: Array<{ bucket: string; path: string; key: string }>
): Record<string, UseSignedUrlReturn> {
  const results: Record<string, UseSignedUrlReturn> = {};

  urls.forEach(({ bucket, path, key }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[key] = useSignedUrl({ bucket, path });
  });

  return results;
}