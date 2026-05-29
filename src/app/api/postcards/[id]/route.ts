import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { createServerClient } from '@/lib/supabase';
import { 
  createApiResponse, 
  type ApiResponse 
} from '@/lib/api-middleware';
// Removed createSignedUrlWithRetry import (no longer needed)
import { handleError, createDetailedError, logError, type ErrorContext } from '@/lib/error-handler';
import { validateUUID, validatePostcardAccess } from '@/lib/validation';
import { logger, createTimer, logApiStart, logApiEnd } from '@/lib/logger';
import type { Database } from '@/types/database';

type PostcardRow = Database['public']['Tables']['postcards']['Row'];

// Pull the relative storage key out of whatever's in image_url / video_url.
// New uploads write raw keys ("<owner>/<postcard>/image.jpg"); some legacy
// rows hold a full signed URL ("https://<project>.supabase.co/storage/v1/
// object/sign/<bucket>/<key>?token=..."). Both shapes collapse to the key
// the storage client expects when generating a fresh signed URL.
function extractStorageKey(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  const path = idx >= 0 ? url.slice(idx + marker.length) : url;
  return path ? path.split('?')[0] : null;
}

interface PostcardResponse {
  id: string;
  status: string;
  image_url?: string;
  video_url?: string;
  title?: string;
  description?: string;
  nft_descriptors?: {
    generated?: boolean;
    timestamp?: string;
    files?: {
      iset?: string;
      fset?: string;
      fset3?: string;
    }
    metadata?: {
      originalImageUrl?: string;
      postcardId?: string;
      userId?: string;
      note?: string;
    };
  };
  created_at: string;
  message?: string;
  user_id?: string;
  // NEW:
  is_activated?: boolean;
  fulfillment_type?: 'digital' | 'physical' | null;
  activated_at?: string | null;
}

async function handleGetPostcard(
  req: NextRequest,
  params: Record<string, string>,
  context: ErrorContext
): Promise<NextResponse<ApiResponse<PostcardResponse>>> {
  const postcardId = params.id;
  logger.debug('Starting postcard retrieval from database', { postcardId });
  
  // Validate UUID format
  const uuidValidation = validateUUID(params.id, 'id');
  if (!uuidValidation.isValid) {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context,
      new Error(`Invalid postcard ID: ${uuidValidation.errors.map(e => e.message).join(', ')}`)
    );
    logError(detailedError);
    throw detailedError;
  }
  
  const supabase = createServerClient();

  // Get postcard data
  logger.database('select', 'postcards', { postcardId });
  
  const { data: postcard, error } = await supabase
    .from('postcards')
    .select('*')
    .eq('id', postcardId)
    .single() as { data: PostcardRow | null; error: { code?: string; message: string } | null };

  if (error || !postcard) {
    if (error?.code === 'PGRST116') {
      logger.warn('Postcard not found', { postcardId });
    } else if (error) {
      logger.error('Database error fetching postcard', { 
        postcardId
      }, new Error(error.message));
    }
    const detailedError = createDetailedError('POSTCARD_NOT_FOUND', context);
    logError(detailedError);
    throw detailedError;
  }
  
  logger.info('Postcard fetched from database', { 
    postcardId
  });

  // Check if postcard is ready
  if (postcard.processing_status !== 'ready') {
    return createApiResponse(
      true,
      {
        id: postcard.id,
        status: postcard.processing_status,
        message: postcard.processing_status === 'processing'
          ? 'La postal aún se está procesando'
          : 'La postal no está lista para verse en realidad aumentada',
        created_at: postcard.created_at
      }
    );
  }

  // Generate signed URLs dynamically for image and video - IN PARALLEL
  logger.debug('Generating signed URLs for postcard assets', { postcardId });
  const startTime = Date.now();

  // postcards.image_url / video_url store the raw storage key (e.g.
  // "<owner_id>/<postcard_id>/image.jpg") chosen at upload time. For legacy
  // postcards uploaded before the Clerk -> Supabase auth migration that key
  // still carries the Clerk-prefixed folder — which is also where the
  // physical files live, so signing the key as-is works regardless of
  // whether postcards.user_id was later remapped to the new auth UUID.
  // Don't rebuild the path from postcard.user_id; that would point at an
  // empty folder for every pre-migration postcard.
  const imagePath = extractStorageKey(postcard.image_url, 'postcard-images')
    || `${postcard.user_id}/${postcard.id}/image.png`;
  const videoPath = extractStorageKey(postcard.video_url, 'postcard-videos')
    || `${postcard.user_id}/${postcard.id}/video.mp4`;
  
  const urlContext = {
    operation: `GET /api/postcards/${postcardId}`,
    timestamp: new Date().toISOString(),
    postcardId,
    userId: postcard.user_id
  };
  
  // Import once
  const { createSignedUrlWithRetry } = await import('@/lib/storage-utils');
  
  // Generate ALL signed URLs in parallel with reduced retries
  const [imageResult, videoResult] = await Promise.allSettled([
    createSignedUrlWithRetry('postcard-images', imagePath, urlContext, 3600, { maxAttempts: 1, baseDelay: 500 }),
    createSignedUrlWithRetry('postcard-videos', videoPath, urlContext, 3600, { maxAttempts: 1, baseDelay: 500 })
  ]);
  
  const imageUrl = imageResult.status === 'fulfilled' ? imageResult.value : (postcard.image_url || '');
  const videoUrl = videoResult.status === 'fulfilled' ? videoResult.value : (postcard.video_url || '');
  
  console.log(`⏱️ [API-GET] Signed URLs generated in ${Date.now() - startTime}ms`);

  // NFT descriptors - just pass through, no need for signed URLs (using public bucket or proxy)
  const nftDescriptors = postcard.nft_descriptors;

  logger.info('Postcard fetched successfully', {
    postcardId: postcard.id,
    metadata: {
      status: postcard.processing_status,
      hasNftDescriptors: !!nftDescriptors,
    }
  });

  const { userId: callerUserId } = await auth();
  const isOwner = callerUserId === postcard.user_id;
  const visibleToPublic = postcard.is_activated || isOwner;

  return createApiResponse(
    true,
    {
      id: postcard.id,
      user_id: postcard.user_id,
      status: postcard.processing_status,
      title: postcard.title,
      description: postcard.description || undefined,
      created_at: postcard.created_at,
      is_activated: postcard.is_activated,
      fulfillment_type: postcard.fulfillment_type,
      activated_at: postcard.activated_at,
      // Only expose assets if activated OR caller is owner
      image_url: visibleToPublic ? imageUrl : undefined,
      video_url: visibleToPublic ? videoUrl : undefined,
      nft_descriptors: visibleToPublic ? (nftDescriptors as PostcardResponse['nft_descriptors']) : undefined,
    }
  );
}

export async function GET(req: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const timer = createTimer('GET /api/postcards/[id]');
  const startTime = Date.now();
  const params = await context.params;
  const postcardId = params.id;
  
  const errorContext: ErrorContext = {
    operation: `GET /api/postcards/${postcardId}`,
    timestamp: new Date().toISOString(),
    postcardId: postcardId,
    userAgent: req.headers.get('user-agent') || undefined
  };
  
  try {
    logApiStart('GET', `/api/postcards/${postcardId}`);
    
    // Validate method
    if (req.method !== 'GET') {
      const duration = timer();
      logApiEnd('GET', `/api/postcards/${postcardId}`, 405, duration, { postcardId });
      return createApiResponse(
        false,
        undefined,
        {
          message: `Method ${req.method} not allowed`,
          code: 'METHOD_NOT_ALLOWED'
        }
      );
    }
    
    // Validate params
    const validation = validateUUID(postcardId, 'id');
    if (!validation.isValid) {
      const duration = timer();
      logApiEnd('GET', `/api/postcards/${postcardId}`, 400, duration, { postcardId });
      return createApiResponse(
        false,
        undefined,
        {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR'
        },
        validation.errors,
        validation.warnings
      );
    }
    
    logger.info('Fetching postcard', { postcardId });
    const result = await handleGetPostcard(req, params, errorContext);
    const duration = timer();
    
    logger.info('Postcard retrieved successfully', { 
      postcardId,
      duration 
    });
    
    logApiEnd('GET', `/api/postcards/${postcardId}`, 200, duration, { postcardId });
    
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to retrieve postcard', {
      postcardId,
      duration
    }, err instanceof Error ? err : undefined);
    
    logApiEnd('GET', `/api/postcards/${postcardId}`, 500, duration, { postcardId });
    const { response } = handleError(err, errorContext, 'INTERNAL_SERVER_ERROR');
    return response;
  }
}

async function handleDeletePostcard(
  req: NextRequest,
  params: Record<string, string>,
  userId: string,
  context: ErrorContext
): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  const postcardId = params.id;
  logger.debug('Starting postcard deletion process', { postcardId });
  
  // Validate UUID format
  const uuidValidation = validateUUID(params.id, 'id');
  if (!uuidValidation.isValid) {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context,
      new Error(`Invalid postcard ID: ${uuidValidation.errors.map(e => e.message).join(', ')}`)
    );
    logError(detailedError);
    throw detailedError;
  }
  
  // Validate postcard access
  const accessValidation = await validatePostcardAccess(params.id, userId);
  if (!accessValidation.isValid) {
    const errorCode = accessValidation.errors.find(e => e.code === 'POSTCARD_NOT_FOUND') 
      ? 'POSTCARD_NOT_FOUND' 
      : 'ACCESS_DENIED';
    const detailedError = createDetailedError(errorCode, context);
    logError(detailedError);
    throw detailedError;
  }
  
  const supabase = createServerClient();

  // Get postcard data for file deletion
  logger.database('select', 'postcards', { postcardId });
  
  const { data: postcard, error: postcardError } = await supabase
    .from('postcards')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single() as { data: PostcardRow | null; error: { code?: string; message: string } | null };

  if (postcardError || !postcard) {
    if (postcardError?.code === 'PGRST116') {
      logger.warn('Postcard not found for deletion', { postcardId });
    } else if (postcardError) {
      logger.error('Database error fetching postcard for deletion', {
         postcardId
       }, new Error(postcardError.message));
    }
    const detailedError = createDetailedError('POSTCARD_NOT_FOUND', context);
    logError(detailedError);
    throw detailedError;
  }
  
  logger.info('Postcard found for deletion', {
    postcardId
  });

  // Bloquear borrado si la postal está activada con fulfillment físico
  if (postcard.is_activated && postcard.fulfillment_type === 'physical') {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context,
      new Error('Cannot delete a postcard with an active physical order — contact support if you need to cancel.')
    );
    logError(detailedError);
    throw detailedError;
  }

  // Derive deterministic storage folder and delete any objects found
  logger.debug('Preparing storage cleanup by folder derivation', { postcardId });
  const folder = `${postcard.user_id}/${postcard.id}`;
  const buckets = ['postcard-images', 'postcard-videos', 'nft-descriptors'] as const;

  const deletionResults: { path: string; bucket: string; success: boolean }[] = [];

  for (const bucketName of buckets) {
    // List objects under the folder (non-recursive; our files live directly under this folder)
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list(folder);

    if (listError) {
      logger.warn('Failed to list storage folder for deletion', {
        postcardId,
        metadata: { bucket: bucketName, folder, error: listError.message }
      });
      continue;
    }

    const paths = (files || [])
      .filter((f) => !!f?.name)
      .map((f) => `${folder}/${f.name}`);

    if (paths.length === 0) {
      logger.debug('No files found to delete in bucket', {
        postcardId,
        metadata: { bucket: bucketName, folder }
      });
      continue;
    }

    logger.storage('delete', bucketName, paths.join(', '), { postcardId });
    const { error: removeError } = await supabase.storage
      .from(bucketName)
      .remove(paths);

    paths.forEach((p) => deletionResults.push({ path: p, bucket: bucketName, success: !removeError }));

    if (removeError) {
      logger.warn('Failed to delete some files from storage', {
        postcardId,
        metadata: { bucket: bucketName, folder, error: removeError.message }
      });
    } else {
      logger.debug('Files deleted successfully from storage', {
        postcardId,
        metadata: { fileCount: paths.length, bucket: bucketName }
      });
    }
  }

  // Delete the postcard record
  logger.database('delete', 'postcards', { postcardId });
  
  const { error: deleteError } = await supabase
    .from('postcards')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId);

  if (deleteError) {
    logger.error('Database error deleting postcard', { 
      postcardId, 
      metadata: { error: deleteError.message } 
    }, new Error(deleteError.message));
    return createApiResponse(
      false,
      { message: 'Failed to delete postcard from database' },
      {
        message: 'Failed to delete postcard from database',
        code: 'DATABASE_ERROR',
        details: deleteError
      }
    );
  }
  
  logger.info('Postcard deleted successfully', { postcardId });

  console.log('✅ [API-DELETE] Postcard deleted successfully:', {
    id: params.id,
    deleted_files: deletionResults.length,
    buckets_cleaned: Array.from(new Set(deletionResults.map((r) => r.bucket)))
  });

  return createApiResponse(
    true,
    {
      deleted_files: deletionResults,
      message: 'Postcard deleted successfully'
    }
  );
}

export async function DELETE(req: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const timer = createTimer('DELETE /api/postcards/[id]');
  const startTime = Date.now();
  const params = await context.params;
  const postcardId = params.id;
  
  const errorContext: ErrorContext = {
    operation: `DELETE /api/postcards/${postcardId}`,
    timestamp: new Date().toISOString(),
    postcardId: postcardId,
    userAgent: req.headers.get('user-agent') || undefined
  };
  
  try {
    logApiStart('DELETE', `/api/postcards/${postcardId}`);
    
    // Validate method
    if (req.method !== 'DELETE') {
      const duration = timer();
      logApiEnd('DELETE', `/api/postcards/${postcardId}`, 405, duration, { postcardId });
      return createApiResponse(
        false,
        undefined,
        {
          message: `Method ${req.method} not allowed`,
          code: 'METHOD_NOT_ALLOWED'
        }
      );
    }
    
    // Validate params
    const validation = validateUUID(postcardId, 'id');
    if (!validation.isValid) {
      const duration = timer();
      logApiEnd('DELETE', `/api/postcards/${postcardId}`, 400, duration, { postcardId });
      return createApiResponse(
        false,
        undefined,
        {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR'
        },
        validation.errors,
        validation.warnings
      );
    }
    
    const { userId } = await auth();
    
    if (!userId) {
      const duration = timer();
      logApiEnd('DELETE', `/api/postcards/${postcardId}`, 401, duration, { 
        userId: 'anonymous', 
        postcardId 
      });
      const detailedError = createDetailedError('UNAUTHORIZED', errorContext);
      logError(detailedError);
      return createApiResponse(
        false,
        undefined,
        {
          message: 'Authentication required',
          code: 'UNAUTHORIZED'
        }
      );
    }

    logger.info('User authenticated for postcard deletion', { userId, postcardId });
    errorContext.userId = userId;
    const result = await handleDeletePostcard(req, params, userId, errorContext);
    const duration = timer();
    
    logger.info('Postcard deleted successfully', { 
      userId, 
      postcardId,
      duration 
    });
    
    logApiEnd('DELETE', `/api/postcards/${postcardId}`, 200, duration, { 
      userId, 
      postcardId 
    });
    
    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    
    logger.error('Error deleting postcard', { 
      userId: errorContext.userId || 'unknown',
      postcardId,
      duration,
      metadata: { errorMessage: err instanceof Error ? err.message : 'Unknown error' }
    }, err instanceof Error ? err : undefined);
    
    logApiEnd('DELETE', `/api/postcards/${postcardId}`, 500, duration, { postcardId });
    const { response } = handleError(err, errorContext, 'INTERNAL_SERVER_ERROR');
    return response;
  }
}