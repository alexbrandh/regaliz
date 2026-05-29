'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Browser Supabase client (singleton) — uses the anon key + cookie-based auth.
// Singleton so onAuthStateChange listeners across the app share one channel.
export function createClient() {
  if (cached) return cached;
  cached = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
