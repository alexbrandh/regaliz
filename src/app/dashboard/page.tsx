import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { MainLayout } from '@/components/layout/MainLayout';
import { listPostcardsForUser } from '@/lib/postcards/list-for-user';
import { DashboardClient } from './DashboardClient';

// Server Component: resolve the Clerk user, list their postcards in parallel
// with the layout chrome, and hand the array off to the client island. The
// client hook hydrates from initialPostcards and skips its mount-time fetch,
// so the first paint already has data instead of a skeleton + spinner.
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const initialPostcards = await listPostcardsForUser(userId);

  return (
    <MainLayout>
      <DashboardClient initialPostcards={initialPostcards} />
    </MainLayout>
  );
}
