export default function AppointmentsLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-60 animate-pulse rounded bg-muted" />
      </div>

      <div className="mb-5 flex gap-2">
        <div className="h-9 w-[170px] animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-[170px] animate-pulse rounded-md bg-muted" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <ul className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-5 w-20 animate-pulse rounded-full bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
