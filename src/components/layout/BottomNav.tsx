'use client';

import dynamic from 'next/dynamic';

// The bottom nav is persistent chrome — not part of first paint, the LCP, or
// any above-the-fold content. Loading it client-only keeps react-icons,
// next-themes and the Supabase auth client off the initial hydration path,
// which is the landing page's heaviest non-essential JS. The space it occupies
// is already reserved by `pb-24` on <main>, so its deferred mount causes no
// layout shift.
const GradientMenu = dynamic(() => import('@/components/ui/gradient-menu'), {
  ssr: false,
});

export function BottomNav() {
  return <GradientMenu />;
}
