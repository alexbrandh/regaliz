import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserById } from '@/lib/auth/admin';
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
    const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  } catch {
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const params = await context.params;
    const id = params.id;
    const body = await request.json();
    const { password } = body;

    if (!checkAdminPassword(password)) {
      return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('postcards')
      .select('*')
      .eq('id', id)
      .single() as { data: PostcardRow | null; error: { message: string } | null };

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Postal no encontrada' }, { status: 404 });
    }

    const [imageUrl, videoUrl] = await Promise.all([
      getSignedUrl('postcard-images', data.image_url),
      getSignedUrl('postcard-videos', data.video_url),
    ]);

    const { data: viewRows } = await supabase
      .from('ar_views')
      .select('viewed_at')
      .eq('postcard_id', id)
      .order('viewed_at', { ascending: false })
      .limit(20);
    const views = (viewRows || []) as Array<{ viewed_at: string }>;

    let user = {
      email: 'Migración pendiente',
      firstName: null as string | null,
      lastName: null as string | null,
      imageUrl: null as string | null,
    };
    try {
      const u = await getUserById(data.user_id);
      if (u) {
        user = {
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          imageUrl: u.imageUrl,
        };
      }
    } catch (err) {
      console.error(`Failed to fetch user ${data.user_id}:`, err);
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://regaliz.vercel.app').trim();
    const timeline: Array<{ type: string; at: string; meta?: unknown }> = [
      { type: 'created', at: data.created_at },
    ];
    if (data.updated_at !== data.created_at) {
      timeline.push({ type: 'updated', at: data.updated_at });
    }
    if (views.length > 0) {
      timeline.push({ type: 'first_view', at: views[views.length - 1].viewed_at });
      timeline.push({ type: 'last_view', at: views[0].viewed_at });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        image_url: imageUrl || data.image_url,
        video_url: videoUrl || data.video_url,
        ar_view_count: views.length,
        user,
        arLink: `${baseUrl}/ar/${data.id}`.replace(/\s+/g, ''),
        timeline,
      },
    });
  } catch (error) {
    console.error('Get postcard error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const params = await context.params;
    const id = params.id;
    const body = await request.json();
    const { password } = body;

    if (!checkAdminPassword(password)) {
      return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: postcard } = await supabase
      .from('postcards')
      .select('id, user_id')
      .eq('id', id)
      .single() as { data: { id: string; user_id: string } | null };

    if (!postcard) {
      return NextResponse.json({ success: false, error: 'Postal no encontrada' }, { status: 404 });
    }

    const folder = `${postcard.user_id}/${postcard.id}`;
    for (const bucket of ['postcard-images', 'postcard-videos', 'postcard-targets']) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(folder);
        if (files && files.length > 0) {
          await supabase.storage
            .from(bucket)
            .remove(files.map(f => `${folder}/${f.name}`));
        }
      } catch (err) {
        console.warn(`Could not clear ${bucket}/${folder}:`, err);
      }
    }

    await supabase.from('ar_views').delete().eq('postcard_id', id);
    const { error: delError } = await supabase.from('postcards').delete().eq('id', id);

    if (delError) {
      return NextResponse.json({ success: false, error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete postcard error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
