import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Mirrors the shape of Clerk's `auth()` so the rest of the codebase can
// continue passing `userId: string | null` around. Backed by Supabase.
export async function auth(): Promise<{ userId: string | null; email: string | null }> {
  const supabase = await createClient();
  // getUser() validates the session with Supabase Auth on every call — safer
  // than getSession() which trusts the cookie locally.
  const { data: { user } } = await supabase.auth.getUser();
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
  };
}

// Helper for Server Components/Pages that must be authenticated. Redirects
// to /sign-in when no user is present. Equivalent of Clerk's auth.protect().
export async function requireUser(): Promise<{ userId: string; email: string | null }> {
  const { userId, email } = await auth();
  if (!userId) redirect('/sign-in');
  return { userId, email };
}
