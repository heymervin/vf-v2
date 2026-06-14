export const metadata = { title: "Appointments" };

export default function AppointmentsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8 flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-[-0.022em] text-foreground">
          Appointments
        </h2>
        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Coming soon
        </span>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm max-w-xl">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Not built yet
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          Appointment scheduling is on the roadmap
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This feature is planned for a future milestone. For now, coordinate
          viewings directly with couples from their contact page.
        </p>
      </div>
    </div>
  );
}
