import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth/server';

/**
 * POST /api/nft/upload-descriptors
 * Receives NFT descriptor files generated on the client and uploads them to Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const postcardId = formData.get('postcardId') as string;
    const isetFile = formData.get('iset') as File;
    const fsetFile = formData.get('fset') as File;
    const fset3File = formData.get('fset3') as File;

    if (!postcardId || !isetFile || !fsetFile || !fset3File) {
      return NextResponse.json({ error: 'Missing required files' }, { status: 400 });
    }

    console.log(`📤 Uploading client-generated NFT descriptors for postcard: ${postcardId}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify postcard exists and belongs to user
    const { data: postcard, error: fetchError } = await supabase
      .from('postcards')
      .select('id, user_id')
      .eq('id', postcardId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !postcard) {
      return NextResponse.json({ error: 'Postcard not found' }, { status: 404 });
    }

    // Upload files to Supabase Storage
    const storagePath = `${userId}/${postcardId}/nft`;
    const uploadResults: { [key: string]: string } = {};

    const files = [
      { file: isetFile, name: 'descriptors.iset' },
      { file: fsetFile, name: 'descriptors.fset' },
      { file: fset3File, name: 'descriptors.fset3' }
    ];

    for (const { file, name } of files) {
      const buffer = await file.arrayBuffer();
      const uploadPath = `${storagePath}/${name}`;
      
      console.log(`📤 Uploading ${name} (${buffer.byteLength} bytes)...`);
      
      const { error: uploadError } = await supabase.storage
        .from('postcards')
        .upload(uploadPath, buffer, {
          contentType: 'application/octet-stream',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`❌ Error uploading ${name}:`, uploadError);
        return NextResponse.json({ error: `Failed to upload ${name}` }, { status: 500 });
      }
      
      // Generate signed URL
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('postcards')
        .createSignedUrl(uploadPath, 3600 * 24 * 7); // 7 days
      
      if (!urlError && signedUrlData) {
        uploadResults[name] = signedUrlData.signedUrl;
      }
      
      console.log(`✅ ${name} uploaded successfully`);
    }

    // Update postcard with real NFT descriptors
    const nftDescriptors = {
      descriptorUrl: `/api/ar/nft/${userId}/${postcardId}/descriptors`,
      generated: true,
      timestamp: new Date().toISOString(),
      generatedBy: 'client-wasm',
      files: {
        iset: uploadResults['descriptors.iset'] || '',
        fset: uploadResults['descriptors.fset'] || '',
        fset3: uploadResults['descriptors.fset3'] || ''
      },
      metadata: {
        postcardId,
        userId,
        note: 'Generated using AR.js NFT Marker Creator (client-side WASM)'
      }
    };

    // Verify video exists before marking as ready
    const videoFolder = `${userId}/${postcardId}`;
    const { data: videoFiles } = await supabase.storage
      .from('postcard-videos')
      .list(videoFolder);
    const videoExists = videoFiles && videoFiles.length > 0 && videoFiles.some(f => f.name?.includes('video'));

    if (!videoExists) {
      console.warn(`⚠️ Video not found for postcard ${postcardId}. Not marking as ready.`);
    }

    const { error: updateError } = await supabase
      .from('postcards')
      .update({
        nft_descriptors: nftDescriptors,
        processing_status: videoExists ? 'ready' : 'processing',
        error_message: videoExists ? null : 'Video aún no se ha subido completamente',
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    if (updateError) {
      console.error('❌ Error updating postcard:', updateError);
      return NextResponse.json({ error: 'Failed to update postcard' }, { status: 500 });
    }

    console.log('🎉 Client-generated NFT descriptors uploaded and saved successfully!');

    return NextResponse.json({
      success: true,
      postcardId,
      message: 'NFT descriptors uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Error in upload-descriptors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
