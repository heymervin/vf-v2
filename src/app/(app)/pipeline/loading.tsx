export default function PipelineLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 px-1">
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>

      <div className="-mx-6 flex flex-1 gap-3 overflow-hidden px-6 md:-mx-8 md:px-8">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="flex w-[300px] shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex flex-1 flex-col gap-2 rounded-lg bg-muted/40 p-1.5">
              {Array.from({ length: 3 - (col % 2) }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-lg border border-border bg-card"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
