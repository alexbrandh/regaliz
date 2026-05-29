import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUsersByIds } from '@/lib/auth/admin';
import { checkAdminPassword } from '@/lib/admin-auth';

interface RequestBody {
  password: string;
  days?: number;
}

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

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { password, days = 30 } = body;

    if (!checkAdminPassword(password)) {
      return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const supabase = createServerClient();
    const now = Date.now();
    const periodMs = days * 24 * 60 * 60 * 1000;
    const startCurrent = new Date(now - periodMs);
    const startPrevious = new Date(now - 2 * periodMs);

    const [createdRows, viewRows, prevCreatedRows, prevViewRows] = await Promise.all([
      supabase.from('postcards').select('created_at').gte('created_at', startCurrent.toISOString()),
      supabase.from('ar_views').select('viewed_at').gte('viewed_at', startCurrent.toISOString()),
      supabase
        .from('postcards')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startPrevious.toISOString())
        .lt('created_at', startCurrent.toISOString()),
      supabase
        .from('ar_views')
        .select('id', { count: 'exact', head: true })
        .gte('viewed_at', startPrevious.toISOString())
        .lt('viewed_at', startCurrent.toISOString()),
    ]);

    const daily: Array<{ date: string; created: number; views: number }> = [];
    const dayMap: Record<string, { created: number; views: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(now - (days - 1 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { created: 0, views: 0 };
    }

    for (const row of (createdRows.data || []) as Array<{ created_at: string }>) {
      const key = row.created_at.slice(0, 10);
      if (dayMap[key]) dayMap[key].created++;
    }
    for (const row of (viewRows.data || []) as Array<{ viewed_at: string }>) {
      const key = row.viewed_at.slice(0, 10);
      if (dayMap[key]) dayMap[key].views++;
    }
    for (const key of Object.keys(dayMap)) {
      daily.push({ date: key, ...dayMap[key] });
    }

    // Top 5 postcards by total view count
    const { data: allViews } = await supabase.from('ar_views').select('postcard_id');
    const counts: Record<string, number> = {};
    for (const row of (allViews || []) as Array<{ postcard_id: string }>) {
      counts[row.postcard_id] = (counts[row.postcard_id] || 0) + 1;
    }
    const topIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topPostcards: Array<{
      id: string;
      title: string;
      image_url: string;
      ar_view_count: number;
      user: { email: string; firstName: string | null; lastName: string | null; imageUrl: string | null };
    }> = [];

    if (topIds.length) {
      const { data: topRows } = await supabase
        .from('postcards')
        .select('id, title, image_url, user_id')
        .in('id', topIds);

      const userIds = [...new Set((topRows || []).map(r => (r as { user_id: string }).user_id))];
      let usersMap: Record<string, { email: string; firstName: string | null; lastName: string | null; imageUrl: string | null }> = {};
      if (userIds.length) {
        try {
          usersMap = await getUsersByIds(userIds);
        } catch (err) {
          console.error('Error fetching users:', err);
        }
      }

      type TopRow = { id: string; title: string; image_url: string; user_id: string };
      const rows = (topRows || []) as TopRow[];

      topPostcards = await Promise.all(
        topIds
          .map(id => rows.find(r => r.id === id))
          .filter((r): r is TopRow => !!r)
          .map(async r => ({
            id: r.id,
            title: r.title,
            image_url: (await getSignedUrl('postcard-images', r.image_url)) || r.image_url,
            ar_view_count: counts[r.id] || 0,
            user: usersMap[r.user_id] || { email: 'Desconocido', firstName: null, lastName: null, imageUrl: null },
          }))
      );
    }

    const currentCreated = (createdRows.data || []).length;
    const currentViews = (viewRows.data || []).length;

    return NextResponse.json({
      success: true,
      data: {
        daily,
        currentPeriod: { created: currentCreated, views: currentViews },
        previousPeriod: {
          created: prevCreatedRows.count ?? 0,
          views: prevViewRows.count ?? 0,
        },
        topPostcards,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
