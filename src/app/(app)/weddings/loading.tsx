// Streams instantly on navigation into /weddings and all nested workspace tabs
// (loading.tsx cascades to child segments without their own boundary).
export default function WeddingsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
        <div className="mt-5 h-4 w-80 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-border bg-card shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
