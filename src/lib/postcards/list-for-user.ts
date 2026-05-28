import 'server-only';
import { createServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Postcard, Database } from '@/types/database';

type PostcardRow = Database['public']['Tables']['postcards']['Row'];

/**
 * Server-only: fetch every postcard belonging to `userId`, batch-sign image
 * and video URLs, and return them in created_at DESC order. Single source of
 * truth for both the GET /api/postcards route handler and the dashboard
 * Server Component that pre-fetches initialData.
 */
export async function listPostcardsForUser(userId: string): Promise<Postcard[]> {
  const supabase = createServerClient();

  const { data: rows, error } = await supabase
    .from('postcards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listPostcardsForUser: db query failed', {
      userId,
      metadata: { error: error.message },
    }, new Error(error.message));
    throw new Error('Failed to fetch postcards');
  }

  const postcardList = (rows ?? []) as PostcardRow[];
  if (postcardList.length === 0) return [];

  const imagePaths: (string | null)[] = postcardList.map((p) => extractStoragePath(p.image_url, 'postcard-images'));
  const videoPaths: (string | null)[] = postcardList.map((p) => extractStoragePath(p.video_url, 'postcard-videos'));

  const validImagePaths = imagePaths.filter((p): p is string => p !== null);
  const validVideoPaths = videoPaths.filter((p): p is string => p !== null);

  const [imageSignedMap, videoSignedMap] = await Promise.all([
    batchSign(supabase, 'postcard-images', validImagePaths),
    batchSign(supabase, 'postcard-videos', validVideoPaths),
  ]);

  return postcardList.map((postcard, index): Postcard => {
    const imgPath = imagePaths[index];
    const vidPath = videoPaths[index];
    return {
      ...postcard,
      image_url: (imgPath && imageSignedMap[imgPath]) || postcard.image_url || '',
      video_url: (vidPath && videoSignedMap[vidPath]) || postcard.video_url || '',
    } as Postcard;
  });
}

function extractStoragePath(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  const path = idx >= 0 ? url.slice(idx + marker.length) : url;
  return path ? path.split('?')[0] : null;
}

async function batchSign(
  supabase: ReturnType<typeof createServerClient>,
  bucket: 'postcard-images' | 'postcard-videos',
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
    if (error || !data) {
      logger.warn('batchSign failed', { metadata: { bucket, error: error?.message, pathCount: paths.length } });
      return {};
    }
    const map: Record<string, string> = {};
    for (const item of data) {
      if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
    }
    return map;
  } catch (err) {
    logger.warn('batchSign threw', { metadata: { bucket, error: err instanceof Error ? err.message : String(err) } });
    return {};
  }
}
