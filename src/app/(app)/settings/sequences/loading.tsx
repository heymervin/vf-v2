export default function SettingsSequencesLoading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-8">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
