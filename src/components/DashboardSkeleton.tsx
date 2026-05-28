// Skeleton that mirrors the dashboard layout so the user sees real page
// structure instead of a centered spinner while Clerk + the fetch settle.

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted/70 ${className}`} aria-hidden="true" />
);

const StatCardSkeleton = () => (
  <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
    <SkeletonBlock className="h-3 w-20 mb-3" />
    <SkeletonBlock className="h-8 w-16" />
  </div>
);

const PostcardCardSkeleton = () => (
  <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
    <div className="p-4">
      <SkeletonBlock className="h-5 w-32 mb-2" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
    <div className="px-4 pb-4">
      <SkeletonBlock className="aspect-video w-full rounded-xl" />
    </div>
  </div>
);

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <SkeletonBlock className="h-8 w-56 mb-2" />
            <SkeletonBlock className="h-4 w-40" />
          </div>
          <SkeletonBlock className="h-12 w-full sm:w-52 rounded-md" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Filters bar */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <SkeletonBlock className="h-10 flex-1 rounded-md" />
            <SkeletonBlock className="h-10 w-full sm:w-[220px] rounded-md" />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          <PostcardCardSkeleton />
          <PostcardCardSkeleton />
          <PostcardCardSkeleton />
          <PostcardCardSkeleton />
          <PostcardCardSkeleton />
          <PostcardCardSkeleton />
        </div>
      </div>
    </div>
  );
}
