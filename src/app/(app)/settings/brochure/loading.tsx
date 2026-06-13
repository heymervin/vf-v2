export default function SettingsBrochureLoading() {
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-8">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-lg border-2 border-dashed border-border bg-muted/40" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
