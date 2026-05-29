'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Server Action invoked by the sign-in / sign-up button. Builds the
// Google OAuth URL using Supabase and 303-redirects the browser to it.
// The browser then bounces to /auth/callback?code=... where the session
// cookie is set.
export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get('origin')
    || `https://${headerStore.get('host')}`;

  const rawNext = formData.get('next');
  const next = typeof rawNext === 'string' && rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : '/dashboard';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message || 'oauth_failed')}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
