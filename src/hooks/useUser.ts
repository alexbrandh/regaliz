'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type UseUserState = {
  user: User | null;
  isLoaded: boolean;
};

// Drop-in client-side replacement for `useUser()` from @clerk/nextjs.
// Subscribes to Supabase auth state so the hook reflects sign-in/sign-out
// across tabs without a manual refresh.
export function useUser(): UseUserState {
  const [state, setState] = useState<UseUserState>({ user: null, isLoaded: false });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setState({ user: data.user, isLoaded: true });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setState({ user: session?.user ?? null, isLoaded: true });
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
