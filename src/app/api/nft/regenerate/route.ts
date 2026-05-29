import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth/server';
import { generateRealNFTDescriptors } from '@/lib/real-nft-generator';

/**
 * POST /api/nft/regenerate
 * Regenerate NFT descriptors for an existing postcard using the real generator
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postcardId } = await request.json();

    if (!postcardId) {
      return NextResponse.json({ error: 'Postcard ID is required' }, { status: 400 });
    }

    console.log(`🔄 Regenerating NFT descriptors for postcard: ${postcardId}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get postcard data
    const { data: postcard, error: fetchError } = await supabase
      .from('postcards')
      .select('*')
      .eq('id', postcardId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !postcard) {
      return NextResponse.json({ error: 'Postcard not found' }, { status: 404 });
    }

    if (!postcard.image_url) {
      return NextResponse.json({ error: 'Postcard has no image' }, { status: 400 });
    }

    // Update status to processing
    await supabase
      .from('postcards')
      .update({ 
        processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    // Generate real NFT descriptors
    console.log('🔧 Generating real NFT descriptors...');
    const result = await generateRealNFTDescriptors(
      postcard.image_url,
      supabase,
      postcardId,
      userId
    );

    // Update postcard with new descriptors
    const descriptors = {
      descriptorUrl: result.fsetUrl.replace('.fset', ''),
      generated: true,
      timestamp: new Date().toISOString(),
      files: {
        iset: result.isetUrl,
        fset: result.fsetUrl,
        fset3: result.fset3Url
      },
      metadata: {
        originalImageUrl: postcard.image_url,
        postcardId,
        userId,
        note: 'Generated using Real AR.js NFT Generator'
      }
    };

    await supabase
      .from('postcards')
      .update({ 
        processing_status: 'ready',
        nft_descriptors: descriptors,
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    console.log('✅ NFT descriptors regenerated successfully!');

    return NextResponse.json({
      success: true,
      postcardId,
      descriptors,
      message: 'NFT descriptors regenerated successfully with real AR.js generator'
    });

  } catch (error) {
    console.error('❌ Error regenerating NFT descriptors:', error);
    return NextResponse.json(
      { 
        error: 'Failed to regenerate NFT descriptors',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
