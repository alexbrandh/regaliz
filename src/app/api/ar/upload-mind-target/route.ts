import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth/server';

/**
 * POST /api/ar/upload-mind-target
 * Receives compiled MindAR .mind file and uploads to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const postcardId = formData.get('postcardId') as string;
    const mindFile = formData.get('mindFile') as File;

    if (!postcardId || !mindFile) {
      return NextResponse.json({ error: 'Missing postcardId or mindFile' }, { status: 400 });
    }

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

    // Upload .mind file to Supabase Storage
    const storagePath = `${userId}/${postcardId}/target.mind`;
    const buffer = await mindFile.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('postcards')
      .upload(storagePath, buffer, {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading .mind file:', uploadError);
      return NextResponse.json({ error: 'Failed to upload target file' }, { status: 500 });
    }

    // Get public URL for the .mind file
    const { data: urlData } = supabase.storage
      .from('postcards')
      .getPublicUrl(storagePath);

    // Update postcard with MindAR target info
    // Video is guaranteed to exist: the client awaits video upload completion
    // before calling this endpoint (via videoUploadPromiseRef in useMindARBrowserCompiler).
    const mindTargetInfo = {
      type: 'mindar',
      targetUrl: `/api/ar/mind-target/${userId}/${postcardId}`,
      publicUrl: urlData?.publicUrl || null,
      generated: true,
      timestamp: new Date().toISOString(),
      generatedBy: 'mindar-compiler-client',
      fileSize: buffer.byteLength
    };

    const { error: updateError } = await supabase
      .from('postcards')
      .update({
        nft_descriptors: mindTargetInfo,
        processing_status: 'ready',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    if (updateError) {
      console.error('Error updating postcard:', updateError);
      return NextResponse.json({ error: 'Failed to update postcard' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      postcardId,
      targetUrl: mindTargetInfo.targetUrl,
      message: 'MindAR target uploaded successfully'
    });

  } catch (error) {
    console.error('Error in upload-mind-target:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
