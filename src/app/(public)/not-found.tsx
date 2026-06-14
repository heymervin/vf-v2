export default function PublicNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[var(--background)] px-4 py-16 text-center">
      <div className="w-full max-w-[480px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          404 — Page not found
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.022em] text-foreground">
          This venue page isn&apos;t available
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The link may be out of date or the venue may have changed their
          address. Try asking the venue directly for their latest enquiry link.
        </p>
        <p className="mt-8 text-xs text-muted-foreground">Powered by VenueFlow</p>
      </div>
    </main>
  );
}
