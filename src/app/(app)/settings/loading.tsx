// Covers /settings and every settings sub-page that lacks its own loading.tsx.
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="mt-5 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-card shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
