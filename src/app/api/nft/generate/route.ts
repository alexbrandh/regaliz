import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth/server';
import { generateNFTDescriptors } from '@/lib/nft-generator';
import { 
  createApiResponse, 
  withErrorHandling, 
  withMethodValidation,
  withRateLimit,
  compose 
} from '@/lib/api-middleware';
import { validatePostcardAccess, validateNFTDescriptors } from '@/lib/validation';

// Extend the function timeout to 120 seconds for NFT generation
export const maxDuration = 120;

async function handleGenerateNFT(
  request: NextRequest
) {
  const { userId } = await auth();
  
  if (!userId) {
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }
    );
  }

  const { postcardId } = await request.json();

  if (!postcardId) {
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Postcard ID is required',
        code: 'MISSING_POSTCARD_ID'
      }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get postcard data
  const { data: postcard, error: fetchError } = await supabase
    .from('postcards')
    .select('*')
    .eq('id', postcardId)
    .single();

  if (fetchError || !postcard) {
    console.error('Error fetching postcard:', fetchError);
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Postcard not found',
        code: 'POSTCARD_NOT_FOUND',
        details: fetchError
      }
    );
  }

  // Validate postcard access (ensure authenticated user owns the postcard)
  const accessValidation = await validatePostcardAccess(postcardId, userId);
  if (!accessValidation.isValid) {
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Access denied to postcard',
        code: 'ACCESS_DENIED'
      },
      accessValidation.errors
    );
  }

  // Try to resolve missing image_url: brief DB retry then storage fallback
  if (!postcard.image_url) {
    // Brief retry: the POST /api/postcards may update image_url slightly after creation
    for (let attempt = 0; attempt < 2 && !postcard.image_url; attempt++) {
      await new Promise((res) => setTimeout(res, 500));
      const { data: latest, error: latestErr } = await supabase
        .from('postcards')
        .select('image_url')
        .eq('id', postcardId)
        .single();
      if (!latestErr && latest?.image_url) {
        postcard.image_url = latest.image_url;
        break;
      }
    }

    // Storage fallback: check deterministic folder for image.* and sign a URL
    if (!postcard.image_url) {
      try {
        const folder = `${postcard.user_id}/${postcardId}`;
        const { data: files, error: listError } = await supabase.storage
          .from('postcard-images')
          .list(folder);

        if (!listError && Array.isArray(files) && files.length > 0) {
          const candidate = files.find((f) => f.name?.startsWith('image.')) || files[0];
          if (candidate?.name) {
            const imgPath = `${folder}/${candidate.name}`;
            const { data: signed, error: signErr } = await supabase.storage
              .from('postcard-images')
              .createSignedUrl(imgPath, 3600);
            if (!signErr && signed?.signedUrl) {
              postcard.image_url = signed.signedUrl;
              // Best-effort update so future reads find it
              await supabase
                .from('postcards')
                .update({ image_url: postcard.image_url, updated_at: new Date().toISOString() })
                .eq('id', postcardId);
            }
          }
        }
      } catch (e) {
        console.warn('Image URL fallback resolution failed', e);
      }
    }

    if (!postcard.image_url) {
      return createApiResponse(
        false,
        undefined,
        {
          message: 'No image found for this postcard',
          code: 'MISSING_IMAGE'
        }
      );
    }
  }

  // If already ready with descriptors, return success immediately
  if (postcard.processing_status === 'ready' && postcard.nft_descriptors) {
    return createApiResponse(
      true,
      {
        postcardId,
        descriptors: postcard.nft_descriptors,
        message: 'NFT descriptors already available'
      }
    );
  }

  // If marked as processing but descriptors are missing (stale state), do NOT return 409; kick off generation
  if (postcard.processing_status === 'processing' && !postcard.nft_descriptors) {
    console.warn('Stale processing status without descriptors; proceeding to (re)start generation', { postcardId });
    // Fall through to generation path below
  } else if (postcard.processing_status === 'processing') {
    // If processing and descriptors exist, treat as already available
    if (postcard.nft_descriptors) {
      return createApiResponse(
        true,
        {
          postcardId,
          descriptors: postcard.nft_descriptors,
          message: 'NFT descriptors already available (processing)'
        }
      );
    }
    // Otherwise keep previous behavior (optional): return 409
    return createApiResponse(
      false,
      undefined,
      {
        message: 'Postcard is already being processed',
        code: 'ALREADY_PROCESSING'
      }
    );
  }

  console.log('🚀 [API] Starting NFT generation for postcard:', postcardId);

  // Update status to processing
  const { error: updateProcessingError } = await supabase
    .from('postcards')
    .update({ 
      processing_status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', postcardId);

  if (updateProcessingError) {
    console.error('❌ [API] Failed to update processing status:', updateProcessingError);
  }

  // Ensure we have a full URL, not just a path
  let imageUrl = postcard.image_url;
  if (!imageUrl.startsWith('http')) {
    console.log('📸 [API] Image URL is a path, generating signed URL...');
    // The image_url is just a path, need to generate a signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from('postcard-images')
      .createSignedUrl(imageUrl, 3600); // 1 hour
    
    if (signError || !signedData?.signedUrl) {
      console.error('❌ [API] Failed to generate signed URL for image:', signError);
      
      // Update status to error
      await supabase
        .from('postcards')
        .update({ 
          processing_status: 'error',
          error_message: 'Failed to access image',
          updated_at: new Date().toISOString()
        })
        .eq('id', postcardId);
      
      return createApiResponse(
        false,
        undefined,
        {
          message: 'Failed to access image',
          code: 'IMAGE_ACCESS_ERROR'
        }
      );
    }
    imageUrl = signedData.signedUrl;
    console.log('✅ [API] Generated signed URL for image');
  }

  console.log('🔧 [API] Calling NFT descriptor generator...');
  
  // Generate NFT descriptors with try-catch for safety
  let result;
  try {
    result = await generateNFTDescriptors({
      imageUrl,
      postcardId,
      userId
    });
    console.log('📦 [API] NFT generator returned:', result ? 'SUCCESS' : 'NULL');
  } catch (genError) {
    console.error('❌ [API] NFT generation threw an error:', genError);
    result = null;
  }

  if (!result) {
    console.error('NFT generation failed');
    
    // Update postcard status to error
    await supabase
      .from('postcards')
      .update({ 
        processing_status: 'error',
        error_message: 'NFT generation failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    return createApiResponse(
      false,
      undefined,
      {
        message: 'NFT generation failed',
        code: 'NFT_GENERATION_FAILED'
      }
    );
  }

  // Validate generated NFT descriptors (validate the full descriptor object)
  const descriptorValidation = validateNFTDescriptors(result);

  if (!descriptorValidation.isValid) {
    console.error('Generated NFT descriptors validation failed:', descriptorValidation.errors);
    
    // Update postcard status to needs_better_image
    await supabase
      .from('postcards')
      .update({ 
        processing_status: 'needs_better_image',
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    return createApiResponse(
      false,
      undefined,
      {
        message: 'Generated NFT descriptors are invalid',
        code: 'INVALID_NFT_DESCRIPTORS'
      },
      descriptorValidation.errors
    );
  }

  console.log('NFT descriptors generated successfully for postcard:', postcardId);

  // Verify video exists in storage before marking as ready
  const videoFolder = `${postcard.user_id}/${postcardId}`;
  const { data: videoFiles } = await supabase.storage
    .from('postcard-videos')
    .list(videoFolder);
  const videoExists = videoFiles && videoFiles.length > 0 && videoFiles.some((f) => f.name?.includes('video'));

  if (!videoExists) {
    console.warn(`⚠️ Video not found for postcard ${postcardId}. Not marking as ready.`);
  }

  // CRITICAL: Update postcard status to ready only if video exists
  await supabase
    .from('postcards')
    .update({ 
      processing_status: videoExists ? 'ready' : 'processing',
      nft_descriptors: result,
      error_message: videoExists ? null : 'Video aún no se ha subido completamente',
      updated_at: new Date().toISOString()
    })
    .eq('id', postcardId);

  return createApiResponse(
    true,
    {
      postcardId,
      descriptors: result,
      message: 'NFT descriptors generated successfully'
    }
  );
}

export const POST = compose(
  withMethodValidation(['POST']),
  withRateLimit(10, 60000), // 10 requests per minute
  withErrorHandling
)(handleGenerateNFT);

/**
 * GET /api/nft/generate?postcardId=xxx
 * Check NFT generation status for a postcard
 */
export async function GET(request: NextRequest) {
  try {
    const noCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    };
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: noCacheHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const postcardId = searchParams.get('postcardId');

    if (!postcardId) {
      return NextResponse.json(
        { error: 'Postcard ID is required' },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // Get postcard status
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: postcard, error } = await supabase
      .from('postcards')
      .select('id, processing_status, error_message, nft_descriptors')
      .eq('id', postcardId)
      .eq('user_id', userId)
      .single();

    if (error || !postcard) {
      return NextResponse.json(
        { error: 'Postcard not found or access denied' },
        { status: 404, headers: noCacheHeaders }
      );
    }

    return NextResponse.json({
      postcardId,
      status: postcard.processing_status,
      errorMessage: postcard.error_message,
      hasDescriptors: !!postcard.nft_descriptors,
      ready: postcard.processing_status === 'ready' && !!postcard.nft_descriptors
    }, { headers: noCacheHeaders });

  } catch (error) {
    console.error('Error checking NFT generation status:', error);
    const res = createApiResponse(
      false,
      undefined,
      {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error
      }
    );
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    res.headers.set('Surrogate-Control', 'no-store');
    return res;
  }
}