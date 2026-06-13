export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
