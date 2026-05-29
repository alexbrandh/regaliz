import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// Server-side Supabase client bound to the request's cookies. Reads the
// active session and refreshes the auth cookie when needed. Use this in
// Server Components, Route Handlers, and Server Actions.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — middleware handles
            // session refresh, so we can safely ignore.
          }
        },
      },
    }
  );
}

export async function getPostcard(id: string) {
  const supabase = await createClient();
  
  const { data: postcard, error } = await supabase
    .from('postcards')
    .select('*')
    .eq('id', id)
    .eq('processing_status', 'ready')
    .single();

  if (error) {
    throw new Error('Postcard not found');
  }

  return postcard;
}