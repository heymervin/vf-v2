export default function SettingsAvailabilityLoading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-8">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      {/* Meeting types skeleton */}
      <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-6 w-10 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Availability rules skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-5 w-44 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-6 animate-pulse rounded bg-muted" />
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
