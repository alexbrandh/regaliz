export function PhoneSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <div className="h-[60vh] w-[28vh] max-w-[260px] animate-pulse rounded-[2.5rem] bg-linear-to-br from-primary/20 to-ring/20 blur-2xl" />
    </div>
  );
}
