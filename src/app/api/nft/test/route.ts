import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth/server';

/**
 * Test endpoint to verify NFT generation works
 * GET /api/nft/test?postcardId=xxx
 */
export async function GET(request: NextRequest) {
  console.log('🧪 [NFT-TEST] Test endpoint called');
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const postcardId = searchParams.get('postcardId');
    
    if (!postcardId) {
      return NextResponse.json({ error: 'postcardId required' }, { status: 400 });
    }
    
    console.log('🔧 [NFT-TEST] Testing NFT generation for:', { postcardId, userId });
    
    // Check environment variables
    const envCheck = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    console.log('🔧 [NFT-TEST] Environment check:', envCheck);
    
    if (!envCheck.hasSupabaseUrl || !envCheck.hasServiceKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        envCheck
      }, { status: 500 });
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get postcard
    const { data: postcard, error: fetchError } = await supabase
      .from('postcards')
      .select('*')
      .eq('id', postcardId)
      .single();
    
    if (fetchError || !postcard) {
      console.error('❌ [NFT-TEST] Postcard not found:', fetchError);
      return NextResponse.json({
        error: 'Postcard not found',
        details: fetchError
      }, { status: 404 });
    }
    
    console.log('📋 [NFT-TEST] Postcard found:', {
      id: postcard.id,
      title: postcard.title,
      hasImageUrl: !!postcard.image_url,
      processingStatus: postcard.processing_status,
      hasDescriptors: !!postcard.nft_descriptors
    });
    
    // Check storage bucket
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    console.log('📦 [NFT-TEST] Storage buckets:', buckets?.map(b => b.name) || []);
    
    if (bucketsError) {
      console.error('❌ [NFT-TEST] Error listing buckets:', bucketsError);
    }
    
    // Try to list files in the NFT folder
    const nftPath = `${userId}/${postcardId}/nft`;
    const { data: nftFiles, error: listError } = await supabase.storage
      .from('postcards')
      .list(nftPath);
    
    console.log('📁 [NFT-TEST] NFT files in storage:', nftFiles || []);
    
    if (listError) {
      console.error('❌ [NFT-TEST] Error listing NFT files:', listError);
    }
    
    return NextResponse.json({
      success: true,
      postcard: {
        id: postcard.id,
        title: postcard.title,
        hasImageUrl: !!postcard.image_url,
        imageUrlStart: postcard.image_url?.substring(0, 100) + '...',
        processingStatus: postcard.processing_status,
        hasDescriptors: !!postcard.nft_descriptors
      },
      storage: {
        buckets: buckets?.map(b => b.name) || [],
        nftFiles: nftFiles || [],
        nftPath
      },
      envCheck
    });
    
  } catch (error) {
    console.error('❌ [NFT-TEST] Error:', error);
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
