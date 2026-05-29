'use client';

import { useUser } from '@/hooks/useUser';

// Drop-in replacements for Clerk's <SignedIn>/<SignedOut>. Render nothing
// until auth state is loaded so we don't briefly flash the wrong UI.
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded || user) return null;
  return <>{children}</>;
}
