import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';

// Next.js convention file: rendered as the route-segment fallback while the
// dashboard page's JS hydrates and the client fetch completes. Lets the user
// see real page chrome before Clerk + /api/postcards resolve.
export default function Loading() {
  return (
    <MainLayout>
      <DashboardSkeleton />
    </MainLayout>
  );
}
