import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { clerkClient } from '@clerk/nextjs/server';
import { checkAdminPassword } from '@/lib/admin-auth';

interface RequestBody {
  password: string;
}

interface PostcardLite {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ViewLite {
  postcard_id: string;
  viewed_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    if (!checkAdminPassword(body.password)) {
      return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const supabase = createServerClient();

    const [{ data: postcardsData }, { data: viewsData }] = await Promise.all([
      supabase.from('postcards').select('id, user_id, created_at, updated_at'),
      supabase.from('ar_views').select('postcard_id, viewed_at'),
    ]);

    const postcards = (postcardsData || []) as PostcardLite[];
    const views = (viewsData || []) as ViewLite[];

    const postcardToUser: Record<string, string> = {};
    for (const p of postcards) postcardToUser[p.id] = p.user_id;

    const userStats: Record<string, { postcardCount: number; totalViews: number; lastActivity: string | null }> = {};

    for (const p of postcards) {
      if (!userStats[p.user_id]) {
        userStats[p.user_id] = { postcardCount: 0, totalViews: 0, lastActivity: null };
      }
      userStats[p.user_id].postcardCount++;
      const last = p.updated_at;
      if (!userStats[p.user_id].lastActivity || last > userStats[p.user_id].lastActivity!) {
        userStats[p.user_id].lastActivity = last;
      }
    }

    for (const v of views) {
      const uid = postcardToUser[v.postcard_id];
      if (!uid) continue;
      if (!userStats[uid]) userStats[uid] = { postcardCount: 0, totalViews: 0, lastActivity: null };
      userStats[uid].totalViews++;
      if (!userStats[uid].lastActivity || v.viewed_at > userStats[uid].lastActivity!) {
        userStats[uid].lastActivity = v.viewed_at;
      }
    }

    const userIds = Object.keys(userStats);
    const usersOut: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
      postcardCount: number;
      totalViews: number;
      lastActivity: string | null;
    }> = [];

    if (userIds.length) {
      try {
        const client = await clerkClient();
        const { data: users } = await client.users.getUserList({ userId: userIds, limit: userIds.length });
        for (const u of users) {
          const s = userStats[u.id];
          if (!s) continue;
          usersOut.push({
            id: u.id,
            email: u.emailAddresses[0]?.emailAddress || 'Sin correo',
            firstName: u.firstName,
            lastName: u.lastName,
            imageUrl: u.imageUrl ?? null,
            postcardCount: s.postcardCount,
            totalViews: s.totalViews,
            lastActivity: s.lastActivity,
          });
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    }

    usersOut.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return b.lastActivity.localeCompare(a.lastActivity);
    });

    return NextResponse.json({ success: true, data: { users: usersOut } });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
