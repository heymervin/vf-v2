export default function CopilotLoading() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="mt-5 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
