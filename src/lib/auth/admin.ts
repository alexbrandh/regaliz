import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client for the auth admin API. Service role bypasses
// RLS and unlocks `auth.admin.*` — keep this server-only and never expose
// the key in client-side bundles.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface AdminUserLite {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

const PAGE_SIZE = 1000;

// Fetch users by ID. Supabase admin API only exposes single-get and
// paginated list — we call list() once (small user base) and filter in
// memory. Postcards still tied to legacy Clerk IDs (`user_*`) won't match
// and fall back to a "Desconocido" placeholder upstream.
export async function getUsersByIds(ids: string[]): Promise<Record<string, AdminUserLite>> {
  if (ids.length === 0) return {};

  const wanted = new Set(ids);
  const out: Record<string, AdminUserLite> = {};

  const client = serviceClient();
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      console.error('getUsersByIds: listUsers failed', error);
      break;
    }
    for (const u of data.users) {
      if (!wanted.has(u.id)) continue;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = typeof meta.full_name === 'string' ? meta.full_name : '';
      const [first, ...rest] = fullName.split(' ');
      out[u.id] = {
        id: u.id,
        email: u.email || 'Sin correo',
        firstName: (typeof meta.given_name === 'string' && meta.given_name) || first || null,
        lastName: (typeof meta.family_name === 'string' && meta.family_name) || (rest.length ? rest.join(' ') : null),
        imageUrl: (typeof meta.avatar_url === 'string' && meta.avatar_url)
          || (typeof meta.picture === 'string' && meta.picture)
          || null,
      };
    }
    if (data.users.length < PAGE_SIZE) break;
    page += 1;
  }

  return out;
}

export async function getUserById(id: string): Promise<AdminUserLite | null> {
  const client = serviceClient();
  const { data, error } = await client.auth.admin.getUserById(id);
  if (error || !data.user) return null;
  const u = data.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : '';
  const [first, ...rest] = fullName.split(' ');
  return {
    id: u.id,
    email: u.email || 'Sin correo',
    firstName: (typeof meta.given_name === 'string' && meta.given_name) || first || null,
    lastName: (typeof meta.family_name === 'string' && meta.family_name) || (rest.length ? rest.join(' ') : null),
    imageUrl: (typeof meta.avatar_url === 'string' && meta.avatar_url)
      || (typeof meta.picture === 'string' && meta.picture)
      || null,
  };
}
