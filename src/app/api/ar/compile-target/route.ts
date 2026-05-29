import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth/server';
import { Jimp } from 'jimp';

/**
 * POST /api/ar/compile-target
 * Compiles an image into a MindAR .mind target file on the server
 * Uses Jimp (pure JS) to avoid native dependencies
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postcardId } = await request.json();

    if (!postcardId) {
      return NextResponse.json({ error: 'Missing postcardId' }, { status: 400 });
    }

    console.log(`🎯 [MINDAR] Starting target compilation for postcard: ${postcardId}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get postcard to find image URL
    const { data: postcard, error: fetchError } = await supabase
      .from('postcards')
      .select('id, user_id, image_url')
      .eq('id', postcardId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !postcard) {
      return NextResponse.json({ error: 'Postcard not found' }, { status: 404 });
    }

    if (!postcard.image_url) {
      return NextResponse.json({ error: 'Postcard has no image' }, { status: 400 });
    }

    // Download image from Supabase Storage
    console.log(`📥 [MINDAR] Downloading image from Supabase Storage...`);
    
    let imageBuffer: Buffer | null = null;
    try {
      // The image_url might be a relative path like "user_id/postcard_id/image.png"
      // or a full signed URL. We need to handle both cases.
      
      if (postcard.image_url.startsWith('http')) {
        // It's a full URL (signed URL) - fetch it directly
        const response = await fetch(postcard.image_url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else {
        // It's a storage path - download from Supabase Storage
        // Images are stored in 'postcard-images' bucket
        const storagePath = `${userId}/${postcardId}/image.png`;
        console.log(`📥 [MINDAR] Trying storage path: postcard-images/${storagePath}`);
        
        const { data, error: downloadError } = await supabase.storage
          .from('postcard-images')
          .download(storagePath);
        
        if (downloadError || !data) {
          // Try alternative extensions
          const extensions = ['jpg', 'jpeg', 'webp'];
          let found = false;
          
          for (const ext of extensions) {
            const altPath = `${userId}/${postcardId}/image.${ext}`;
            console.log(`📥 [MINDAR] Trying: postcard-images/${altPath}`);
            
            const { data: altData, error: altError } = await supabase.storage
              .from('postcard-images')
              .download(altPath);
            
            if (!altError && altData) {
              const arrayBuffer = await altData.arrayBuffer();
              imageBuffer = Buffer.from(arrayBuffer);
              found = true;
              break;
            }
          }
          
          if (!found) {
            throw new Error(`Storage download failed: ${downloadError?.message}`);
          }
        } else {
          const arrayBuffer = await data.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        }
      }
    } catch (e) {
      console.error('Error downloading image:', e);
      return NextResponse.json({ error: `Failed to download image: ${e instanceof Error ? e.message : 'unknown'}` }, { status: 500 });
    }

    if (!imageBuffer) {
      return NextResponse.json({ error: 'Failed to download image: no data' }, { status: 500 });
    }

    // Process image using Jimp
    console.log(`🔧 [MINDAR] Processing image (${imageBuffer.length} bytes)...`);
    
    let image: Awaited<ReturnType<typeof Jimp.read>>;
    try {
      image = await Jimp.read(imageBuffer);
    } catch (e) {
      console.error('Error processing image:', e);
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }

    // Resize if needed (MindAR works best with images < 1024px)
    const maxSize = 1024;
    if (image.width > maxSize || image.height > maxSize) {
      image.scaleToFit({ w: maxSize, h: maxSize });
    }

    // Get image data for MindAR compiler
    const width = image.width;
    const height = image.height;
    
    // Create ImageData-like object for MindAR
    const imageData = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height
    };

    // Copy pixel data from Jimp to ImageData format
    const bitmap = image.bitmap;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        imageData.data[idx] = bitmap.data[idx];     // R
        imageData.data[idx + 1] = bitmap.data[idx + 1]; // G
        imageData.data[idx + 2] = bitmap.data[idx + 2]; // B
        imageData.data[idx + 3] = bitmap.data[idx + 3]; // A
      }
    }

    // Compile using MindAR
    console.log(`⚙️ [MINDAR] Compiling target (${width}x${height})...`);
    
    // @ts-ignore - MindAR doesn't have types
    const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js');
    
    const compiler = new Compiler();
    
    // MindAR compiler can work with ImageData-like objects
    await compiler.compileImageTargets([imageData], (progress: number) => {
      if (progress % 0.1 < 0.01) { // Log every 10%
        console.log(`⚙️ [MINDAR] Progress: ${Math.round(progress * 100)}%`);
      }
    });
    
    // Export the compiled data
    const exportedBuffer = await compiler.exportData();
    
    console.log(`✅ [MINDAR] Target compiled, size: ${exportedBuffer.byteLength} bytes`);

    // Upload .mind file to Supabase
    const storagePath = `${userId}/${postcardId}/target.mind`;
    
    const { error: uploadError } = await supabase.storage
      .from('postcards')
      .upload(storagePath, Buffer.from(exportedBuffer), {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading .mind file:', uploadError);
      return NextResponse.json({ error: 'Failed to upload target file' }, { status: 500 });
    }

    // Update postcard with MindAR target info
    const mindTargetInfo = {
      type: 'mindar',
      targetUrl: `/api/ar/mind-target/${userId}/${postcardId}`,
      generated: true,
      timestamp: new Date().toISOString(),
      generatedBy: 'mindar-server',
      fileSize: exportedBuffer.byteLength
    };

    const { error: updateError } = await supabase
      .from('postcards')
      .update({
        nft_descriptors: mindTargetInfo,
        processing_status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', postcardId);

    if (updateError) {
      console.error('Error updating postcard:', updateError);
      return NextResponse.json({ error: 'Failed to update postcard' }, { status: 500 });
    }

    console.log(`🎉 [MINDAR] Target compilation complete for postcard: ${postcardId}`);

    return NextResponse.json({
      success: true,
      postcardId,
      targetUrl: mindTargetInfo.targetUrl,
      fileSize: exportedBuffer.byteLength
    });

  } catch (error) {
    console.error('❌ [MINDAR] Compilation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
