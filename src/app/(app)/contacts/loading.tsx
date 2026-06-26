export default function ContactsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-7">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="mt-5 h-4 w-80 animate-pulse rounded bg-muted" />
      </div>

      {/* Saved-view pills */}
      <div className="mb-3 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
        <div className="h-8 w-full animate-pulse rounded-md bg-muted sm:w-64" />
        <div className="h-8 w-[140px] animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-8 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="h-10 border-b border-border bg-muted/30" />
        <ul className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-4 w-44 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-4 w-24 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
