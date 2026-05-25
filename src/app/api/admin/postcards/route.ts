import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { clerkClient } from '@clerk/nextjs/server';
import { checkAdminPassword } from '@/lib/admin-auth';

async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  if (!path) return null;
  try {
    const supabase = createServerClient();
    let storagePath = path;
    if (path.includes(`/${bucket}/`)) {
      storagePath = path.split(`/${bucket}/`)[1]?.split('?')[0] || path;
    }
    storagePath = storagePath.split('?')[0];

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(`Error creating signed URL for ${bucket}/${storagePath}:`, error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error(`Exception creating signed URL for ${bucket}/${path}:`, err);
    return null;
  }
}

interface PostcardRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string;
  video_url: string;
  processing_status: 'processing' | 'ready' | 'error' | 'needs_better_image';
  error_message: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface RequestBody {
  password: string;
  page?: number;
  limit?: number;
  status?: 'all' | 'ready' | 'processing' | 'error' | 'needs_better_image';
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'ar_view_count';
  sortDir?: 'asc' | 'desc';
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const {
      password,
      page,
      limit,
      status = 'all',
      search,
      sortBy = 'created_at',
      sortDir = 'desc',
      userId,
    } = body;

    if (!checkAdminPassword(password)) {
      return NextResponse.json(
        { success: false, error: 'Contraseña incorrecta' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Fetch all postcards (small dataset for now — pagination applied after enrichment)
    let baseQuery = supabase.from('postcards').select('*');
    if (status !== 'all') baseQuery = baseQuery.eq('processing_status', status);
    if (userId) baseQuery = baseQuery.eq('user_id', userId);

    // Apply DB-level sort when possible
    if (sortBy === 'created_at' || sortBy === 'updated_at' || sortBy === 'title') {
      baseQuery = baseQuery.order(sortBy, { ascending: sortDir === 'asc' });
    } else {
      baseQuery = baseQuery.order('created_at', { ascending: false });
    }

    const { data, error } = await baseQuery;

    if (error) {
      console.error('Error fetching postcards:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener las postales' },
        { status: 500 }
      );
    }

    let postcards = (data || []) as PostcardRow[];

    // Apply text search (in-memory, small dataset)
    const trimmedSearch = search?.trim().toLowerCase();
    if (trimmedSearch) {
      postcards = postcards.filter(p =>
        p.title.toLowerCase().includes(trimmedSearch) ||
        (p.description?.toLowerCase().includes(trimmedSearch))
      );
    }

    // Aggregate AR view counts globally (for stats) and per-postcard
    const { data: viewCounts, error: viewError } = await supabase
      .from('ar_views')
      .select('postcard_id');

    const viewCountMap: Record<string, number> = {};
    let totalArViews = 0;
    if (!viewError && viewCounts) {
      for (const row of viewCounts) {
        viewCountMap[row.postcard_id] = (viewCountMap[row.postcard_id] || 0) + 1;
        totalArViews++;
      }
    }

    // Sort by ar_view_count if requested (post-aggregation)
    if (sortBy === 'ar_view_count') {
      postcards.sort((a, b) => {
        const av = viewCountMap[a.id] || 0;
        const bv = viewCountMap[b.id] || 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }

    // Stats over the full (status-filtered) dataset — we recompute against ALL rows for global stats:
    // For accurate global stats, re-fetch lightweight count regardless of filters
    const [allReady, allProcessing, allError, allNeedsImg, allAll] = await Promise.all([
      supabase.from('postcards').select('id', { count: 'exact', head: true }).eq('processing_status', 'ready'),
      supabase.from('postcards').select('id', { count: 'exact', head: true }).eq('processing_status', 'processing'),
      supabase.from('postcards').select('id', { count: 'exact', head: true }).eq('processing_status', 'error'),
      supabase.from('postcards').select('id', { count: 'exact', head: true }).eq('processing_status', 'needs_better_image'),
      supabase.from('postcards').select('user_id', { count: 'exact' }),
    ]);

    const uniqueUserIds = new Set((allAll.data || []).map(r => (r as { user_id: string }).user_id));

    const stats = {
      total: allAll.count ?? postcards.length,
      ready: allReady.count ?? 0,
      processing: allProcessing.count ?? 0,
      error: allError.count ?? 0,
      needsBetterImage: allNeedsImg.count ?? 0,
      uniqueUsers: uniqueUserIds.size,
      totalArViews,
    };

    // Apply pagination
    const totalAfterFilter = postcards.length;
    let pageNum: number | undefined;
    let pageSize: number | undefined;
    let totalPages: number | undefined;

    if (typeof limit === 'number' && limit >= 0) {
      pageSize = limit;
      pageNum = Math.max(1, page || 1);
      const start = (pageNum - 1) * pageSize;
      const end = pageSize === 0 ? start : start + pageSize;
      postcards = pageSize === 0 ? [] : postcards.slice(start, end);
      totalPages = pageSize === 0 ? 0 : Math.max(1, Math.ceil(totalAfterFilter / pageSize));
    }

    // Hydrate users from Clerk (batch)
    const pageUserIds = [...new Set(postcards.map(p => p.user_id))];
    const usersMap: Record<string, { email: string; firstName: string | null; lastName: string | null; imageUrl: string | null }> = {};

    if (pageUserIds.length) {
      try {
        const client = await clerkClient();
        const { data: users } = await client.users.getUserList({ userId: pageUserIds, limit: pageUserIds.length });
        for (const user of users) {
          usersMap[user.id] = {
            email: user.emailAddresses[0]?.emailAddress || 'Sin correo',
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl ?? null,
          };
        }
      } catch (err) {
        console.error('Error fetching users batch:', err);
      }
    }

    // Generate signed URLs only for the page
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://regaliz.vercel.app').trim();
    const enrichedPostcards = await Promise.all(
      postcards.map(async (postcard) => {
        const [signedImageUrl, signedVideoUrl] = await Promise.all([
          getSignedUrl('postcard-images', postcard.image_url),
          getSignedUrl('postcard-videos', postcard.video_url),
        ]);

        return {
          ...postcard,
          image_url: signedImageUrl || postcard.image_url,
          video_url: signedVideoUrl || postcard.video_url,
          ar_view_count: viewCountMap[postcard.id] || 0,
          user: usersMap[postcard.user_id] || {
            email: 'Desconocido',
            firstName: null,
            lastName: null,
            imageUrl: null,
          },
          arLink: `${baseUrl}/ar/${postcard.id}`.replace(/\s+/g, ''),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        postcards: enrichedPostcards,
        stats,
        ...(pageSize !== undefined ? {
          meta: { total: totalAfterFilter, page: pageNum, limit: pageSize, totalPages },
        } : {}),
      },
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
