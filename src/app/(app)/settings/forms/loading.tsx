export default function SettingsFormsLoading() {
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-8">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
