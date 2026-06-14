"use client";

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[var(--background)] px-4 py-16 text-center">
      <div className="w-full max-w-[480px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.022em] text-foreground">
          This page couldn&apos;t load
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          There was a temporary problem loading this venue page. Please try
          again — if it keeps happening, contact the venue directly.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          Try again
        </button>
        <p className="mt-8 text-xs text-muted-foreground">Powered by VenueFlow</p>
      </div>
    </main>
  );
}
