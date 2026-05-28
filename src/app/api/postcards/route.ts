import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { listPostcardsForUser } from '@/lib/postcards/list-for-user';
import { handleError, createDetailedError, logError, type ErrorContext } from '@/lib/error-handler';
import { validatePostcardData } from '@/lib/validation';
import { z } from 'zod';
import {
  createApiResponse,
  createValidationErrorResponse,
  withErrorHandling,
  withAuth,
  withMethodValidation,
  withTimeout,
  compose,
  type ApiResponse
} from '@/lib/api-middleware';
import { createSignedUploadUrlWithRetry } from '@/lib/storage-utils';
import type { Postcard, Database } from '@/types/database';

type PostcardRow = Database['public']['Tables']['postcards']['Row'];
import { logger, createTimer, logApiStart, logApiEnd } from '@/lib/logger';

const createPostcardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().optional(),
  imageFileName: z.string().min(1, 'Image file name is required'),
  videoFileName: z.string().min(1, 'Video file name is required'),
  imageSize: z.number().positive('Invalid image size'),
  videoSize: z.number().positive('Invalid video size'),
});

type CreatePostcardRequest = z.infer<typeof createPostcardSchema>;

interface CreatePostcardResponse {
  postcard: Postcard;
  imageUploadUrl: string;
  videoUploadUrl: string;
}

async function handleCreatePostcard(
  request: NextRequest,
  body: CreatePostcardRequest,
  userId: string,
  context: ErrorContext
): Promise<NextResponse<ApiResponse<CreatePostcardResponse>>> {
  logger.debug('Starting postcard creation', { userId, metadata: { title: body.title } });
  console.log('📥 [API-POST] Create postcard request received');
  console.log('👤 [API-POST] User ID from auth:', userId);
  console.log('📥 [API-POST] Request body:', JSON.stringify(body, null, 2));

  const validatedData = body; // Body is already validated by middleware

  // Validate postcard data
  const postcardValidation = await validatePostcardData({
    title: validatedData.title,
    note: validatedData.description,
    userId
  });

  if (!postcardValidation.isValid) {
    // Log detailed validation errors and return a structured 400 response
    console.error('❌ [API-POST] Postcard validation failed', {
      userId,
      errors: postcardValidation.errors,
      warnings: postcardValidation.warnings,
      body: {
        title: validatedData.title,
        description: validatedData.description
      }
    });
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Los datos enviados no son válidos',
        code: 'VALIDATION_ERROR'
      },
      postcardValidation.errors,
      postcardValidation.warnings
    ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
  }

  // Validate file sizes
  const maxImageSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '50'); // 50MB default for images
  const maxVideoSizeMB = parseInt(process.env.MAX_VIDEO_SIZE_MB || '250'); // 250MB default for videos
  const maxImageSize = maxImageSizeMB * 1024 * 1024;
  const maxVideoSize = maxVideoSizeMB * 1024 * 1024;

  if (validatedData.imageSize > maxImageSize) {
    return createApiResponse(
      false,
      undefined,
      {
        message: `Image size exceeds maximum allowed size of ${maxImageSizeMB}MB`,
        code: 'FILE_TOO_LARGE'
      }
    ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
  }

  if (validatedData.videoSize > maxVideoSize) {
    return createApiResponse(
      false,
      undefined,
      {
        message: `Video size exceeds maximum allowed size of ${maxVideoSizeMB}MB`,
        code: 'FILE_TOO_LARGE'
      }
    ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
  }

  const supabase = createServerClient();

  // Create postcard record
  logger.database('insert', 'postcards', { userId, metadata: { title: validatedData.title } });

  const { data: postcard, error: insertError } = await (supabase
    .from('postcards') as unknown as {
      insert: (data: Record<string, unknown>) => {
        select: () => {
          single: () => Promise<{ data: PostcardRow | null; error: { code?: string; message: string } | null }>
        }
      }
    })
    .insert({
      user_id: userId,
      title: validatedData.title,
      description: validatedData.description,
      image_url: '', // Will be updated after upload
      video_url: '', // Will be updated after upload
      processing_status: 'processing'
    })
    .select()
    .single();

  if (insertError || !postcard) {
    logger.error('Failed to create postcard record', {
      userId,
      metadata: { error: insertError?.message }
    }, insertError ? new Error(insertError.message) : new Error('No postcard returned'));
    console.error('❌ [API-POST] Error creating postcard:', insertError);
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Failed to create postcard',
        code: 'DATABASE_ERROR',
        details: insertError
      }
    ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
  }

  logger.info('Postcard record created successfully', {
    userId,
    postcardId: postcard.id,
    metadata: { processing_status: postcard.processing_status }
  });

  console.log('✅ [API-POST] Postcard created successfully:', {
    id: postcard.id,
    title: postcard.title,
    user_id: postcard.user_id
  });

  // Generate file paths
  const imageKey = `${userId}/${postcard.id}/image.${validatedData.imageFileName.split('.').pop()}`;
  const videoKey = `${userId}/${postcard.id}/video.${validatedData.videoFileName.split('.').pop()}`;

  console.log('📁 [API-POST] Generated file paths:', {
    imageKey,
    videoKey
  });

  // Generate signed upload URLs with retry logic
  logger.storage('create_upload_url', 'postcard-images', imageKey, {
    userId,
    postcardId: postcard.id
  });
  logger.storage('create_upload_url', 'postcard-videos', videoKey, {
    userId,
    postcardId: postcard.id
  });

  let imageUploadData = null;
  let videoUploadData = null;
  let imageUploadError = null;
  let videoUploadError = null;

  try {
    const [imageUploadResult, videoUploadResult] = await Promise.all([
      createSignedUploadUrlWithRetry('postcard-images', imageKey, context),
      createSignedUploadUrlWithRetry('postcard-videos', videoKey, context)
    ]);
    imageUploadData = imageUploadResult;
    videoUploadData = videoUploadResult;
  } catch (error) {
    imageUploadError = error;
    videoUploadError = error;
  }

  console.log('📤 [API-POST] Signed URL generation results:', {
    imageUploadData: imageUploadData ? 'Generated' : 'Failed',
    videoUploadData: videoUploadData ? 'Generated' : 'Failed',
    imageUploadError,
    videoUploadError
  });

  if (imageUploadError || videoUploadError) {
    console.error('❌ [API-POST] Error creating signed URLs:', { imageUploadError, videoUploadError });

    // Clean up the created postcard
    await supabase.from('postcards').delete().eq('id', postcard.id);

    return createApiResponse(
      false,
      undefined,
      {
        message: 'Failed to generate upload URLs',
        code: 'UPLOAD_URL_ERROR',
        details: { imageUploadError, videoUploadError }
      }
    ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
  }

  // Store the raw storage keys as URLs — files don't exist yet (upload happens
  // client-side), so generating signed GET URLs here would always fail or be
  // wasted. The GET endpoint re-signs on demand when postcards are fetched.
  const imageUrl = imageKey;
  const videoUrl = videoKey;

  // Update postcard with storage keys
  const { error: updateError } = await (supabase
    .from('postcards') as unknown as {
      update: (data: Record<string, unknown>) => {
        eq: (column: string, value: unknown) => Promise<{ error: { code?: string; message: string } | null }>
      }
    })
    .update({
      image_url: imageUrl,
      video_url: videoUrl,
    })
    .eq('id', postcard.id);

  if (updateError) {
    console.error(' [API-POST] Error updating postcard URLs:', updateError);
  }

  console.log(' [API-POST] Postcard created and URLs updated successfully');

  logger.info('Upload URLs generated successfully', {
    userId,
    postcardId: postcard.id,
    metadata: {
      hasImageUrl: !!imageUploadData?.signedUrl,
      hasVideoUrl: !!videoUploadData?.signedUrl
    }
  });

  return createApiResponse(
    true,
    {
      postcard: {
        ...postcard,
        image_url: imageUrl,
        video_url: videoUrl,
      },
      imageUploadUrl: imageUploadData!.signedUrl,
      videoUploadUrl: videoUploadData!.signedUrl,
    }
  );
}

// Create a wrapper function for Zod schema validation
function validateWithZod(schema: z.ZodSchema) {
  return (body: unknown) => {
    try {
      schema.parse(body);
      return { isValid: true, errors: [] };
    } catch (error: unknown) {
      const zodError = error as z.ZodError;
      const errors = zodError.issues?.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: 'VALIDATION_ERROR'
      })) || [{
        field: 'body',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR'
      }];
      return { isValid: false, errors };
    }
  };
}

// Wrapper to handle the middleware chain correctly
async function handleCreatePostcardWithAuth(
  request: NextRequest,
  userId: string
) {
  const context: ErrorContext = {
    operation: 'POST /api/postcards',
    timestamp: new Date().toISOString(),
    userId,
    userAgent: request.headers.get('user-agent') || undefined
  };

  try {
    const body = await request.json();
    console.log('📥 [API-POST] Create postcard request received');
    console.log('👤 [API-POST] User ID from auth:', userId);
    console.log('📥 [API-POST] Request body:', JSON.stringify(body, null, 2));

    // Validate body with Zod
    const validation = validateWithZod(createPostcardSchema)(body);
    if (!validation.isValid) {
      return createValidationErrorResponse(validation) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
    }

    const validatedData = body as CreatePostcardRequest;

    return await handleCreatePostcard(request, validatedData, userId, context);
  } catch (error) {
    console.error('❌ [API-POST] Unhandled error:', error);
    console.error('❌ [API-POST] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    if (error instanceof z.ZodError) {
      const detailedError = createDetailedError(
        'VALIDATION_ERROR',
        context,
        error
      );
      logError(detailedError);
      return createApiResponse(
        false,
        undefined,
        {
          message: 'Los datos enviados no son válidos',
          code: 'VALIDATION_ERROR',
          details: error.issues
        }
      ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
    }

    // Return detailed error in development/staging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return createApiResponse(
      false,
      undefined,
      {
        message: errorMessage,
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV !== 'production' ? { stack: errorStack } : undefined
      }
    ) as unknown as NextResponse<ApiResponse<CreatePostcardResponse>>;
  }
}

export const POST = compose(
  withErrorHandling,
  withMethodValidation(['POST'])
)(withAuth(async (request: NextRequest, userId: string) => {
  const timer = createTimer('POST /api/postcards');
  const startTime = Date.now();

  try {
    logApiStart('POST', '/api/postcards');
    logger.info('User authenticated for postcard creation', { userId });

    const result = await handleCreatePostcardWithAuth(request, userId);
    const duration = timer();

    logger.info('Postcard creation completed', {
      userId,
      duration
    });

    logApiEnd('POST', '/api/postcards', 201, duration, {
      userId
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Error in POST /api/postcards', {
      duration,
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined);

    logApiEnd('POST', '/api/postcards', 500, duration);
    throw error;
  }
}));

async function handleGetPostcards(
  _request: NextRequest,
  userId: string
): Promise<NextResponse<ApiResponse<{ postcards: unknown[] }>> | NextResponse<ApiResponse<undefined>>> {
  try {
    const postcards = await listPostcardsForUser(userId);
    return createApiResponse(true, { postcards });
  } catch (err) {
    return createApiResponse(false, undefined, {
      message: err instanceof Error ? err.message : 'Failed to fetch postcards',
      code: 'DATABASE_ERROR',
    });
  }
}

export const GET = compose(
  withErrorHandling,
  withMethodValidation(['GET'])
)(withAuth(async (request: NextRequest, userId: string) => {
  const timer = createTimer('GET /api/postcards');
  const startTime = Date.now();

  try {
    logApiStart('GET', '/api/postcards');
    logger.info('User authenticated for postcards retrieval', { userId });

    const result = await handleGetPostcards(request, userId);
    const duration = timer();

    logger.info('Postcards retrieved successfully', {
      userId,
      duration
    });

    logApiEnd('GET', '/api/postcards', 200, duration, {
      userId
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Error fetching postcards', {
      duration,
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, error instanceof Error ? error : undefined);

    logApiEnd('GET', '/api/postcards', 500, duration);
    throw error;
  }
}));