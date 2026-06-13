export default function SettingsBillingLoading() {
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-8">
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-10 w-40 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
